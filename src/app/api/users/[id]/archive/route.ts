import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { UserModel } from "@/lib/models/User";
import { ClientModel } from "@/lib/models/Client";
import { TaskModel } from "@/lib/models/Task";
import { TimeOffModel } from "@/lib/models/TimeOff";
import { recordActivity } from "@/lib/activity";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requirePermission(session, "employees.archive");
  if (forbidden) return forbidden;

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot archive your own account" }, { status: 400 });
  }

  await connectDB();

  const user = await UserModel.findById(id, { name: 1, status: 1 }).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.status === "inactive") {
    return NextResponse.json({ error: "User is already archived" }, { status: 400 });
  }

  const userId = id.toString();
  const today = new Date().toISOString().slice(0, 10);

  // Find affected clients before the cascade (for activity recording)
  const affectedClients = await ClientModel.find(
    { "leads.userId": userId },
    { _id: 1, company: 1 }
  ).lean();

  // Cascade operations
  await Promise.all([
    UserModel.findByIdAndUpdate(id, { $set: { status: "inactive" } }),
    ClientModel.updateMany(
      { "leads.userId": userId },
      { $pull: { leads: { userId } } }
    ),
    TaskModel.updateMany(
      { "assignees.userId": userId, completedAt: null },
      { $pull: { assignees: { userId } } }
    ),
    TimeOffModel.deleteMany({ userId: id, startDate: { $gte: today } }),
  ]);

  // Record activity on each affected client (fire-and-forget)
  for (const client of affectedClients) {
    recordActivity({
      clientId: client._id.toString(),
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "lead.archived",
      metadata: { userName: user.name },
    });
  }

  return NextResponse.json({ success: true });
}
