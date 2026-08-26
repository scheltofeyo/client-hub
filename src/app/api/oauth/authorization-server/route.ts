import { NextRequest, NextResponse } from "next/server";
import { hubOrigin } from "@/lib/oauth";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 *
 * The spec requires an MCP authorization server to publish either this or
 * OpenID Connect Discovery. We publish this one only: the hub is not an OIDC
 * provider and issues no id_token, so serving /.well-known/openid-configuration
 * would invite clients to ask for things this server does not do. Clients are
 * required to support both discovery mechanisms, so they fall back cleanly.
 *
 * `issuer` is the request's own origin rather than APP_URL, because a Netlify
 * deploy preview serves this from a different host and RFC 8414 requires the
 * issuer to match the origin the document was fetched from.
 */
export async function GET(req: NextRequest) {
  const origin = hubOrigin(req.headers);

  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      revocation_endpoint: `${origin}/api/oauth/revoke`,
      scopes_supported: MCP_SCOPES,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      // PKCE is the only client authentication this server accepts: every
      // client is public (it runs on someone's machine and can keep no
      // secret), so "none" plus a mandatory S256 challenge is the whole story.
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      // We return `iss` on every authorization response (RFC 9207), which lets
      // a client detect a mix-up attack between two authorization servers.
      authorization_response_iss_parameter_supported: true,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
