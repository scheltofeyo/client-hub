import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { OAuthGrantModel } from "@/lib/models/OAuthGrant";
import { RoleModel } from "@/lib/models/Role";
import { getLeadSettings } from "@/lib/models/LeadSettings";
import { bearerFromHeaders } from "@/lib/api-token";
import { grantPermissions } from "@/lib/oauth";
import { MCP_TOOLS, mayUseTool } from "@/lib/mcp/tools";
import {
  MCP_SCOPES,
  filterKnownScopes,
  isLeadOnlyScope,
  mayDelegateScope,
} from "@/lib/mcp/scopes";
import type { Session } from "next-auth";

/**
 * The connected apps on your own account.
 *
 * Same guard as the personal tokens: a browser session only. Letting a
 * connector enumerate or revoke connections would hand it the power to remove
 * the very thing that lets a person take it away again — and bearerFromHeaders
 * reports OAuth tokens too, so a connector is blocked here for free.
 */
async function requireBrowserSession(): Promise<NextResponse | null> {
  if (await bearerFromHeaders()) {
    return NextResponse.json(
      { error: "Connection management requires a browser session" },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "integrations.tokens");
  if (forbidden) return forbidden;
  const notBrowser = await requireBrowserSession();
  if (notBrowser) return notBrowser;

  await connectDB();
  const [docs, role, leadPerms] = await Promise.all([
    OAuthGrantModel.find({ userId: session!.user.id }).sort({ createdAt: -1 }).lean(),
    RoleModel.findOne({ slug: session!.user.role }, { permissions: 1 }).lean(),
    getLeadSettings(),
  ]);

  // Rights this person could hand over today. A connection made before a scope
  // existed simply does not carry it, and no amount of staring at the app
  // explains why some tools are absent — so the difference is reported.
  const delegable = MCP_SCOPES.filter((scope) => mayDelegateScope(session, scope));

  return NextResponse.json(
    docs.map((doc) => {
      const scopes = doc.scopes ?? [];

      // The tools this connection can actually reach, decided with the very
      // predicate tools/list uses. Anything else would let this page claim a
      // tool the MCP server hides, which is worse than showing no list at all.
      const effective = grantPermissions(role?.permissions ?? [], leadPerms ?? [], scopes);
      const grantSession = {
        ...session!,
        user: { ...session!.user, ...effective },
      } as Session;

      return {
        id: doc._id.toString(),
        clientName: doc.clientName,
        scopes,
        // Narrowed first: a stored scope this server no longer advertises is
        // not a Permission any more, and cannot be lead-anything.
        leadScopes: filterKnownScopes(scopes).filter((scope) => isLeadOnlyScope(session, scope)),
        missing: delegable.filter((scope) => !scopes.includes(scope)),
        tools: MCP_TOOLS.filter((tool) => mayUseTool(grantSession, tool)).map((t) => t.name),
        lastUsedAt: doc.lastUsedAt ?? undefined,
        revokedAt: doc.revokedAt ?? undefined,
        createdAt: doc.createdAt?.toISOString(),
      };
    })
  );
}
