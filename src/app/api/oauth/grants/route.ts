import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { OAuthGrantModel } from "@/lib/models/OAuthGrant";
import { bearerFromHeaders } from "@/lib/api-token";

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
  const docs = await OAuthGrantModel.find({ userId: session!.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientName: doc.clientName,
      scopes: doc.scopes ?? [],
      lastUsedAt: doc.lastUsedAt ?? undefined,
      revokedAt: doc.revokedAt ?? undefined,
      createdAt: doc.createdAt?.toISOString(),
    }))
  );
}
