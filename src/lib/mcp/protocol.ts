/**
 * JSON-RPC 2.0 and MCP protocol plumbing for the hub's MCP server.
 *
 * The server is deliberately "dual-era". MCP revision 2026-07-28 replaced the
 * `initialize` handshake with per-request metadata plus a mandatory
 * `server/discover`, but plenty of clients still open with `initialize`, so we
 * answer both and let the client pick. Which era a request belongs to is read
 * off the request itself, never remembered — the server keeps no session state.
 */

import { SERVER_ICON_PNG_128 } from "./server-icon";

/** Newest first: the first entry is what we advertise as preferred. */
export const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18"] as const;

/** Answer to a legacy `initialize` that asks for something we do not speak. */
export const LATEST_LEGACY_VERSION = "2025-11-25";

/** Assumed when a client sends no MCP-Protocol-Version header (spec default). */
export const ASSUMED_VERSION = "2025-03-26";

export const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
export const SERVER_INFO_META_KEY = "io.modelcontextprotocol/serverInfo";

/**
 * How the server introduces itself: the id clients key on, plus the display
 * name and mark they show instead of a generated letter tile. Carried by both
 * eras — `initialize` returns it as `serverInfo`, `server/discover` puts it
 * under SERVER_INFO_META_KEY.
 */
export const SERVER_INFO = {
  name: "summ-hub",
  title: "SUMM Hub",
  version: "1.0.0",
  icons: [{ src: SERVER_ICON_PNG_128, mimeType: "image/png", sizes: ["128x128"] }],
};

export const SERVER_INSTRUCTIONS =
  "SUMM Hub: clients, the sales funnel, the client logbook and client tasks. Resolve a client " +
  "with find_clients, a board with get_sales_board and a task with list_tasks before writing, " +
  "and pass the ids they return. Every call acts as the person who owns the API token and is " +
  "limited to their permissions, so the tools you can see are the ones you are allowed to use.";

// ── JSON-RPC ─────────────────────────────────────────────────────────

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
/** MCP UnsupportedProtocolVersionError. */
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

export type JsonRpcId = string | number | null;

export interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
}

export function result(id: JsonRpcId, value: Record<string, unknown>) {
  return { jsonrpc: "2.0" as const, id, result: value };
}

export function error(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: Record<string, unknown>
) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: { code, message, ...(data ? { data } : {}) },
  };
}

export function unsupportedVersion(id: JsonRpcId, requested: string) {
  return error(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", {
    supported: [...SUPPORTED_VERSIONS],
    requested,
  });
}

export function isSupportedVersion(version: string): boolean {
  return (SUPPORTED_VERSIONS as readonly string[]).includes(version);
}

/** First revision that carries per-request metadata instead of a handshake. */
const FIRST_MODERN_VERSION = "2026-07-28";

/**
 * Whether a request belongs to the "modern" era. Revision dates are ISO, so a
 * plain string comparison orders them correctly and newer revisions are
 * treated as modern without needing to be listed here.
 *
 * Matters because modern results MUST carry `resultType` — a client on
 * 2026-07-28 rejects a tools/list response without it — while legacy clients
 * are served the same payload without the field.
 */
export function isModernVersion(version: string | null): boolean {
  return !!version && version >= FIRST_MODERN_VERSION;
}

/**
 * A JSON-RPC message with no `id` is a notification: the spec requires a bare
 * 202 with no body rather than a response object.
 */
export function isNotification(msg: JsonRpcMessage): boolean {
  return msg.id === undefined;
}
