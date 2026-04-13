import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { UserModel } from "@/lib/models/User";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requirePermission(session, "employees.archive");
  if (forbidden) return forbidden;

  const { id } = await params;

  await connectDB();

  const user = await UserModel.findById(id, { status: 1 }).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.status !== "inactive") {
    return NextResponse.json({ error: "User is not archived" }, { status: 400 });
  }

  await UserModel.findByIdAndUpdate(id, { $set: { status: "active" } });

  return NextResponse.json({ success: true });
}
