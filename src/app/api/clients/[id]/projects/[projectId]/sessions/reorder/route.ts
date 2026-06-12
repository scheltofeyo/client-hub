import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SessionModel } from "@/lib/models/Session";

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "sessions.edit");
  if (forbidden) return forbidden;

  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  await connectDB();
  await Promise.all(
    ids.map((id: string, index: number) =>
      SessionModel.findByIdAndUpdate(id, { $set: { order: index } })
    )
  );

  return NextResponse.json({ success: true });
}
