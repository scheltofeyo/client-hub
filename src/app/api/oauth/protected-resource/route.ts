import { NextRequest, NextResponse } from "next/server";
import { hubOrigin, mcpResource } from "@/lib/oauth";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * The one document an MCP server MUST publish. A client that gets a 401 reads
 * the `resource_metadata` pointer out of the WWW-Authenticate header, fetches
 * this, and learns which authorization server to talk to — which is what turns
 * "connection failed" in the Claude app into a sign-in prompt.
 *
 * Served from /api/oauth/* and exposed at the spec's /.well-known/* paths by a
 * rewrite in next.config.ts. RFC 9728 forms the well-known URL by inserting the
 * path between host and resource path, so the real URL is
 * /.well-known/oauth-protected-resource/api/mcp; the rewrite also catches the
 * bare form, which some clients probe first.
 */
export async function GET(req: NextRequest) {
  const origin = hubOrigin(req.headers);

  return NextResponse.json(
    {
      resource: mcpResource(origin),
      authorization_servers: [origin],
      scopes_supported: MCP_SCOPES,
      bearer_methods_supported: ["header"],
      resource_documentation: `${origin}/settings`,
    },
    {
      // Public and stable — every caller gets the same document, so a shared
      // cache may hold it. Short enough that adding a tool with a new
      // permission shows up the same day.
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
