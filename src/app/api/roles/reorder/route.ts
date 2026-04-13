import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { RoleModel } from "@/lib/models/Role";
import { requirePermission } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  await connectDB();
  await Promise.all(
    ids.map((id: string, index: number) =>
      RoleModel.findByIdAndUpdate(id, { $set: { rank: index } })
    )
  );

  return NextResponse.json({ success: true });
}
