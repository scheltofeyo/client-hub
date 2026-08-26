import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ApiTokenModel } from "@/lib/models/ApiToken";
import { bearerFromHeaders } from "@/lib/api-token";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "integrations.tokens");
  if (forbidden) return forbidden;
  if (await bearerFromHeaders()) {
    return NextResponse.json(
      { error: "Token management requires a browser session" },
      { status: 403 }
    );
  }

  const { id } = await params;
  await connectDB();

  // Scoped to the owner: someone else's token reads as "not found" rather than
  // "forbidden", so the endpoint never confirms that an id exists.
  const doc = await ApiTokenModel.findOne({ _id: id, userId: session!.user.id }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Revoke rather than delete, so the row stays visible as a record.
  await ApiTokenModel.updateOne(
    { _id: id, userId: session!.user.id },
    { $set: { revokedAt: new Date().toISOString() } }
  );

  return NextResponse.json({ success: true });
}
