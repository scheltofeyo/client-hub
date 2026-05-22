import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission, requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosModel } from "@/lib/models/Kudos";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const doc = await KudosModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSender = doc.fromUserId === session.user.id;
  const isAdmin = hasPermission(session, "admin.kudosCategories");
  if (!isSender && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await KudosModel.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
