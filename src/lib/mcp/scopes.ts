import { MCP_TOOLS } from "./tools";
import { isTokenGrantable, type Permission } from "@/lib/permissions";

/**
 * OAuth scopes for the MCP server.
 *
 * A scope is just a hub permission string. There is no mapping table and no
 * parallel vocabulary on purpose: the tools already declare the permission each
 * one needs, `sessionFromOAuthToken` already intersects role ∩ scope, and an
 * `insufficient_scope` challenge can therefore name the same thing the tool's
 * own refusal message names. Inventing `logs:write` alongside `logs.create`
 * would buy nothing but a translation layer to keep in sync.
 *
 * Derived from MCP_TOOLS rather than hand-listed, so adding a tool with a new
 * permission widens the advertised scopes automatically.
 */
export const MCP_SCOPES: Permission[] = [
  ...new Set(
    MCP_TOOLS.map((tool) => tool.permission).filter(
      (permission): permission is Permission => !!permission && isTokenGrantable(permission)
    )
  ),
].sort();

const KNOWN = new Set<string>(MCP_SCOPES);

/**
 * Keep only scopes this server actually offers.
 *
 * Unknown scopes are dropped rather than rejected. A client that asks for
 * something we do not have should get a working connection limited to what we
 * do have — which is also what the spec's "clients must not assume any
 * relationship to scopes_supported" guidance points at. Applied again when a
 * consent is redeemed, so a grant can only ever hold scopes that mean something
 * here.
 */
export function filterKnownScopes(scopes: string[]): Permission[] {
  return [...new Set(scopes.filter((s): s is Permission => KNOWN.has(s)))];
}

/** Parse an OAuth `scope` parameter — space-delimited, per RFC 6749. */
export function parseScopeParam(raw: string | null): Permission[] {
  if (!raw) return [];
  return filterKnownScopes(raw.split(/\s+/).filter(Boolean));
}
