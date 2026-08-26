import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { MCP_TOOLS, ToolError, findTool } from "@/lib/mcp/tools";
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
 * Authentication is the personal API token from the integrations settings:
 * auth() turns `Authorization: Bearer shub_…` into a real Session with the
 * owner's permissions, so the tools enforce exactly what the rest of the app
 * enforces. Nothing here needs installing on the caller's machine.
 *
 * No CORS headers are set, deliberately. The spec's Origin-validation rule
 * targets DNS-rebinding attacks on servers that authenticate with cookies;
 * this one authenticates with a bearer token a web page cannot mint, and
 * withholding CORS means a page cannot read the response cross-origin either.
 * Do not "fix" this by adding Access-Control-Allow-Origin.
 */

const CAPABILITIES = { tools: {} };

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

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="summ-hub"' } }
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
  const visible = MCP_TOOLS.filter((t) => !t.permission || hasPermission(session, t.permission));

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
      if (tool.permission && !hasPermission(session, tool.permission)) {
        return result(
          id,
          complete(
            toolContent(
              `Not allowed: "${name}" requires the "${tool.permission}" permission, which this ` +
                `token does not carry. Ask an admin to widen the token's scope or your role.`,
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
  if (!session?.user) return unauthorized();

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
