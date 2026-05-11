import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, planId } = await params;
  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  await connectDB();
  const [client, plan] = await Promise.all([
    ClientModel.findById(id).lean(),
    ProjectPlanModel.findOne({ _id: planId, clientId: id }).lean(),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  if (!hasPermissionOrIsLead(session, "projectPlans.edit", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (plan.status === "accepted" || plan.status === "archived") {
    return NextResponse.json({ error: "Cannot modify an accepted or archived plan" }, { status: 400 });
  }

  await Promise.all(
    ids.map((projectId: string, index: number) =>
      ProjectModel.findOneAndUpdate(
        { _id: projectId, clientId: id, planId },
        { $set: { order: index } }
      )
    )
  );

  return NextResponse.json({ success: true });
}
