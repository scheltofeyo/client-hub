import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { bearerFromHeaders } from "@/lib/api-token";
import {
  OAUTH_ACCESS_PREFIX,
  hubOrigin,
  isScopeGap,
  protectedResourceMetadataUrl,
} from "@/lib/oauth";
import { MCP_SCOPES } from "@/lib/mcp/scopes";
import { MCP_TOOLS, ToolError, findTool, mayUseTool } from "@/lib/mcp/tools";
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  PROTOCOL_VERSION_META_KEY,
  SERVER_INFO,
  SERVER_INFO_META_KEY,
  SERVER_INSTRUCTIONS,
  SUPPORTED_VERSIONS,
  LATEST_LEGACY_VERSION,
  error,
  isModernVersion,
  isNotification,
  isSupportedVersion,
  result,
  unsupportedVersion,
  type JsonRpcId,
  type JsonRpcMessage,
} from "@/lib/mcp/protocol";

/**
 * The hub as a remote MCP server.
 *
 * Stateless by design: one POST in, one JSON object out, no SSE stream and no
 * Mcp-Session-Id. A tool-only server has nothing to push, and a long-lived
 * stream sits badly with Netlify's function limits — so every request carries
 * everything needed to serve it.
 *
 * Two ways in, one code path. A personal API token (`Bearer shub_…`) suits a
 * client that can set a static header — Claude Code, a scheduled task — while
 * the Claude app's custom connectors speak OAuth and get a `shubo_…` access
 * token from the hub's own authorization server (src/lib/oauth.ts). auth()
 * resolves either into a real Session carrying the owner's permissions, so
 * everything below this line is indifferent to which arrived.
 *
 * In OAuth terms this route is the resource server. It accepts only tokens it
 * issued itself — they are opaque and matched by hash against a grant, so a
 * token minted for anything else is simply not found — and it points an
 * unauthenticated caller at its Protected Resource Metadata so a client can
 * discover where to sign in.
 *
 * No CORS headers are set, deliberately. The spec's Origin-validation rule
 * targets DNS-rebinding attacks on servers that authenticate with cookies;
 * this one authenticates with a bearer token a web page cannot mint, and
 * withholding CORS means a page cannot read the response cross-origin either.
 * Do not "fix" this by adding Access-Control-Allow-Origin.
 */

const CAPABILITIES = { tools: {} };

/**
 * Raised when an OAuth caller is refused over a scope it could still be
 * granted. Thrown rather than returned because it leaves the JSON-RPC layer
 * entirely: the answer is an HTTP 403 with a WWW-Authenticate challenge, which
 * is the only thing a client can act on to widen its own access.
 */
class ScopeGap extends Error {
  constructor(readonly scope: string) {
    super(`insufficient_scope: ${scope}`);
  }
}

/** Static server description — safe to hold for a while. */
const DISCOVER_TTL_MS = 300_000;
/**
 * Short on purpose: the visible tool list follows the caller's permissions, so
 * a role change or a narrowed token should show up quickly rather than sitting
 * behind a long cache.
 */
const TOOLS_TTL_MS = 60_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * The 401 that starts an OAuth connection.
 *
 * `resource_metadata` is the pointer a client follows to discover which
 * authorization server to use — without it the Claude app has nowhere to go and
 * the connector just fails. The `scope` hint tells it what to ask for up front,
 * so a first connection covers every tool instead of stepping up once per tool.
 */
function unauthorized(req: NextRequest) {
  const metadata = protectedResourceMetadataUrl(hubOrigin(req.headers));
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate":
          `Bearer realm="summ-hub", resource_metadata="${metadata}", ` +
          `scope="${MCP_SCOPES.join(" ")}"`,
      },
    }
  );
}

/**
 * The 403 that asks an OAuth client to widen an existing connection.
 *
 * Used only for a genuine scope gap — the person holds the permission but did
 * not delegate it — because that is the one case re-consenting can fix. When
 * the role never had the permission, a step-up would send the user round the
 * whole flow to be refused again, so that case keeps the readable tool-result
 * refusal instead.
 */
function insufficientScope(req: NextRequest, scope: string) {
  const metadata = protectedResourceMetadataUrl(hubOrigin(req.headers));
  return NextResponse.json(
    { error: "insufficient_scope" },
    {
      status: 403,
      headers: {
        "WWW-Authenticate":
          `Bearer error="insufficient_scope", scope="${scope}", ` +
          `resource_metadata="${metadata}", ` +
          `error_description="This connection was not granted ${scope}"`,
      },
    }
  );
}

/** Content for a tool result — MCP wants text blocks, so JSON goes in one. */
function toolContent(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    isError,
  };
}

/**
 * The protocol version this request claims, from the header (Streamable HTTP)
 * or from per-request `_meta` (revision 2026-07-28 and later).
 *
 * A request that names no version at all is served rather than rejected: the
 * spec's fallback is to assume an old revision, and older clients routinely
 * omit the header, so refusing them would buy nothing.
 */
function requestedVersion(req: NextRequest, msg: JsonRpcMessage): string | null {
  const header = req.headers.get("mcp-protocol-version");
  if (header) return header;
  const params = (msg.params ?? {}) as Record<string, unknown>;
  const meta = (params._meta ?? {}) as Record<string, unknown>;
  const fromMeta = meta[PROTOCOL_VERSION_META_KEY];
  return typeof fromMeta === "string" ? fromMeta : null;
}

async function dispatch(
  session: Session,
  msg: JsonRpcMessage,
  id: JsonRpcId,
  modern: boolean
): Promise<ReturnType<typeof result> | ReturnType<typeof error>> {
  const method = msg.method as string;
  const params = (msg.params ?? {}) as Record<string, unknown>;

  // Revision 2026-07-28 requires resultType on tools/list and tools/call; a
  // client on that revision rejects a response without it. Earlier revisions
  // have no such field, so it is added only when the caller asked for a modern
  // one. We never paginate, so the answer is always the whole set.
  const complete = (value: Record<string, unknown>) =>
    modern ? { resultType: "complete", ...value } : value;

  // Cacheable results (tools/list, server/discover) must also carry caching
  // hints on that revision. tools/list is "private" and MUST stay so: it is
  // filtered by the caller's permissions, and a "public" scope lets a shared
  // cache hand one token's tool list to a different token.
  const cacheable = (value: Record<string, unknown>, ttlMs: number, scope: "public" | "private") =>
    modern ? complete({ ...value, ttlMs, cacheScope: scope }) : value;

  // Only the tools this caller may actually use. Filtering the list is a
  // courtesy to the model, not the authorization boundary — tools/call checks
  // again below, because a client is free to call a tool it never listed.
  const visible = MCP_TOOLS.filter((t) => mayUseTool(session, t));

  switch (method) {
    // Legacy handshake (revision 2025-11-25 and earlier).
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return result(id, {
        protocolVersion: isSupportedVersion(asked) ? asked : LATEST_LEGACY_VERSION,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }

    // Modern discovery (revision 2026-07-28). Servers MUST implement it.
    case "server/discover":
      return result(id, {
        resultType: "complete",
        supportedVersions: [...SUPPORTED_VERSIONS],
        capabilities: CAPABILITIES,
        instructions: SERVER_INSTRUCTIONS,
        // Identical for every caller — the same static server description —
        // so a shared cache may serve it to anyone.
        ttlMs: DISCOVER_TTL_MS,
        cacheScope: "public",
        _meta: { [SERVER_INFO_META_KEY]: SERVER_INFO },
      });

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(
        id,
        cacheable(
          {
            tools: visible.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
          TOOLS_TTL_MS,
          "private"
        )
      );

    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string") {
        return error(id, INVALID_PARAMS, '"name" is required and must be a string');
      }

      const tool = findTool(name);
      if (!tool) {
        const names = visible.map((t) => t.name).join(", ");
        return result(
          id,
          complete(toolContent(`Unknown tool "${name}". Available tools: ${names}.`, true))
        );
      }

      // Refuse before any work starts, so a caller without the permission can
      // never leave a partial write behind.
      if (tool.permission && !mayUseTool(session, tool)) {
        // An OAuth connection that simply was not granted this scope can be
        // widened by re-consenting, so it gets a challenge the client can act
        // on instead of a dead end.
        const raw = await bearerFromHeaders();
        if (raw?.startsWith(OAUTH_ACCESS_PREFIX) && (await isScopeGap(raw, tool.permission))) {
          throw new ScopeGap(tool.permission);
        }
        return result(
          id,
          complete(
            toolContent(
              `Not allowed: "${name}" requires the "${tool.permission}" permission, which this ` +
                `connection does not carry. Ask an admin to widen your role, or reconnect with ` +
                `that permission included.`,
              true
            )
          )
        );
      }

      const args = (params.arguments ?? {}) as Record<string, unknown>;
      if (typeof args !== "object" || args === null || Array.isArray(args)) {
        return error(id, INVALID_PARAMS, '"arguments" must be an object');
      }

      try {
        return result(id, complete(toolContent(await tool.handler(session, args))));
      } catch (err) {
        // A ToolError is a message written for the model; anything else is a
        // bug, and its stack must not travel back over the wire.
        if (err instanceof ToolError) return result(id, complete(toolContent(err.message, true)));
        console.error(`[mcp] ${name} failed:`, err);
        return result(
          id,
          complete(toolContent(`The "${name}" tool failed unexpectedly. Nothing was changed.`, true))
        );
      }
    }

    default:
      return error(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorized(req);

  let msg: JsonRpcMessage;
  try {
    msg = await req.json();
  } catch {
    return json(error(null, PARSE_ERROR, "Parse error"), 400);
  }

  if (Array.isArray(msg)) {
    return json(error(null, INVALID_REQUEST, "Batched requests are not supported"), 400);
  }
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
    return json(error(null, INVALID_REQUEST, "Invalid Request"), 400);
  }

  // Notifications (no id) get a bare 202 with no body — required by the spec,
  // and how `notifications/initialized` is acknowledged.
  if (isNotification(msg)) {
    return new NextResponse(null, { status: 202 });
  }

  const id = msg.id ?? null;

  const version = requestedVersion(req, msg);
  // `initialize` is exempt: negotiating the version is the whole point of it,
  // so a mismatch there is answered with a version we do speak, not an error.
  if (version && !isSupportedVersion(version) && msg.method !== "initialize") {
    return json(unsupportedVersion(id, version));
  }

  try {
    return json(await dispatch(session, msg, id, isModernVersion(version)));
  } catch (err) {
    // Leaves JSON-RPC behind deliberately — see ScopeGap.
    if (err instanceof ScopeGap) return insufficientScope(req, err.scope);
    console.error("[mcp] dispatch failed:", err);
    return json(error(id, INTERNAL_ERROR, "Internal error"));
  }
}

/**
 * 405 is the spec-sanctioned way to say "no SSE stream here"; a client that
 * probes for one falls back to plain request/response.
 */
export async function GET() {
  return NextResponse.json(
    { error: "This MCP server is stateless — no SSE stream is offered. Use POST." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

/** No sessions are kept, so there is nothing for a client to terminate. */
export async function DELETE() {
  return NextResponse.json(
    { error: "This MCP server is stateless — there is no session to delete." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
