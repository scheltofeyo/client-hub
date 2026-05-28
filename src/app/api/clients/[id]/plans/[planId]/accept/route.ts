import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  await connectDB();
  const [client, plan] = await Promise.all([
    ClientModel.findById(id).lean(),
    ProjectPlanModel.findOne({ _id: planId, clientId: id }).lean(),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  if (!hasPermissionOrIsLead(session, "projectPlans.accept", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (plan.status === "accepted") {
    return NextResponse.json({ error: "Plan is already accepted" }, { status: 400 });
  }
  if (plan.status === "finalized") {
    return NextResponse.json({ error: "Plan is already finalized" }, { status: 400 });
  }

  const draftCount = await ProjectModel.countDocuments({ clientId: id, planId, status: "draft" });
  if (draftCount === 0) {
    return NextResponse.json({ error: "Plan has no draft projects to accept" }, { status: 400 });
  }

  const todayIso = new Date().toISOString().split("T")[0];

  const updated = await ProjectPlanModel.findByIdAndUpdate(
    planId,
    {
      $set: {
        status: "accepted",
        acceptedAt: todayIso,
        acceptedBy: {
          userId: session.user.id,
          name: session.user.name ?? "Unknown",
          image: session.user.image ?? undefined,
        },
      },
      $push: {
        acceptanceLog: {
          type: "accepted",
          at: new Date().toISOString(),
          source: "internal",
          by: {
            userId: session.user.id,
            name: session.user.name ?? "Unknown",
            image: session.user.image ?? undefined,
          },
        },
      },
    },
    { new: true }
  ).lean();

  await recordActivity({
    clientId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "plan.accepted",
    metadata: { planId, title: plan.title, projectCount: draftCount },
  });

  return NextResponse.json({
    id: updated!._id.toString(),
    status: updated!.status,
    acceptedAt: updated!.acceptedAt,
    acceptedBy: updated!.acceptedBy,
  });
}
