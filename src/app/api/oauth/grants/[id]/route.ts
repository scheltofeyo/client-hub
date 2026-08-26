import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { OAuthGrantModel } from "@/lib/models/OAuthGrant";
import { bearerFromHeaders } from "@/lib/api-token";

/**
 * Disconnect an app. Mirrors DELETE /api/api-tokens/[id], including its two
 * defences: a browser session only (so a connector cannot cut off the hand that
 * revokes it), and owner-scoping, so someone else's connection reads as "not
 * found" rather than "forbidden" and the endpoint never confirms an id exists.
 *
 * Revoked rather than deleted, so the row stays visible as a record — and
 * because sessionFromOAuthToken checks revokedAt on every call, the connector
 * stops working on its very next request.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "integrations.tokens");
  if (forbidden) return forbidden;
  if (await bearerFromHeaders()) {
    return NextResponse.json(
      { error: "Connection management requires a browser session" },
      { status: 403 }
    );
  }

  const { id } = await params;
  await connectDB();

  const doc = await OAuthGrantModel.findOne({ _id: id, userId: session!.user.id }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await OAuthGrantModel.updateOne(
    { _id: id, userId: session!.user.id },
    // The refresh token goes too: leaving it live would let the client mint a
    // fresh access token straight after being disconnected.
    { $set: { revokedAt: new Date().toISOString() }, $unset: { refreshTokenHash: "" } }
  );

  return NextResponse.json({ success: true });
}
