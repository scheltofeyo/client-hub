import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { UserModel } from "@/lib/models/User";
import { ClientModel } from "@/lib/models/Client";
import { TaskModel } from "@/lib/models/Task";
import { TimeOffModel } from "@/lib/models/TimeOff";

export async function GET(
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

  const today = new Date().toISOString().slice(0, 10);

  const [clients, openTaskCount, futureTimeOffCount] = await Promise.all([
    ClientModel.find({ "leads.userId": id.toString() }, { company: 1 }).lean(),
    TaskModel.countDocuments({ "assignees.userId": id.toString(), completedAt: null }),
    TimeOffModel.countDocuments({ userId: id, startDate: { $gte: today } }),
  ]);

  return NextResponse.json({
    userName: user.name,
    clientLeadCount: clients.length,
    clientNames: clients.map((c) => c.company),
    openTaskCount,
    futureTimeOffCount,
  });
}
