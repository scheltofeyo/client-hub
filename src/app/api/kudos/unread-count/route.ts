import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosModel } from "@/lib/models/Kudos";
import { UserModel } from "@/lib/models/User";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ count: 0 });
  if (!hasPermission(session, "tools.kudos.access")) {
    return NextResponse.json({ count: 0 });
  }

  await connectDB();
  const user = await UserModel.findById(session.user.id).select("lastKudosSeenAt").lean();
  const since = user?.lastKudosSeenAt ?? new Date(0);

  const count = await KudosModel.countDocuments({
    toUserIds: session.user.id,
    fromUserId: { $ne: session.user.id },
    createdAt: { $gt: since },
  });

  return NextResponse.json({ count });
}
