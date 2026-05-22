import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export async function POST() {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await UserModel.findByIdAndUpdate(session.user.id, {
    $set: { lastKudosSeenAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
