import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";

/**
 * Revoke an accepted plan. Reverses the accept-flow:
 *   - Plan status: accepted → ready
 *   - Promoted projects (planId matches, status === "not_started") → back to "draft"
 *   - Clear acceptedBy, acceptedAt, acceptedByClient
 *
 * Refuses to revoke if any promoted project has already moved past not_started
 * (in_progress or completed) — at that point real work has started and a revoke
 * would create cascading inconsistencies.
 */
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

  if (plan.status !== "accepted") {
    return NextResponse.json({ error: "Only accepted plans can be revoked" }, { status: 400 });
  }

  // Find all projects promoted from this plan
  const promoted = await ProjectModel.find({
    clientId: id,
    planId,
    status: { $ne: "draft" },
  }).lean();

  const inFlight = promoted.filter((p) => p.status !== "not_started");
  if (inFlight.length > 0) {
    const titles = inFlight.map((p) => `"${p.title}"`).join(", ");
    return NextResponse.json(
      {
        error: `Cannot revoke: ${inFlight.length} project${inFlight.length === 1 ? " has" : "s have"} already been kicked off (${titles}). Reset ${inFlight.length === 1 ? "it" : "them"} to upcoming first.`,
      },
      { status: 400 }
    );
  }

  // Flip each promoted (not_started) project back to draft
  await Promise.all(
    promoted.map((p) =>
      ProjectModel.findByIdAndUpdate(p._id, { $set: { status: "draft" } })
    )
  );

  // Clear acceptance state on the plan + push a revoke event to the audit trail.
  // Plan goes back to "draft" so the public link shows a maintenance state and the
  // consultant can iterate before sharing again via "Mark as ready".
  const updated = await ProjectPlanModel.findByIdAndUpdate(
    planId,
    {
      $set: { status: "draft" },
      $unset: { acceptedAt: 1, acceptedBy: 1, acceptedByClient: 1 },
      $push: {
        acceptanceLog: {
          type: "revoked",
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
    type: "plan.revoked",
    metadata: { planId, title: plan.title, projectCount: promoted.length },
  });

  return NextResponse.json({
    id: updated!._id.toString(),
    status: updated!.status,
    acceptedAt: null,
    acceptedBy: null,
    acceptedByClient: null,
    revokedProjectIds: promoted.map((p) => p._id.toString()),
  });
}
