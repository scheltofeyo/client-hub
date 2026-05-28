import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { hasPermissionOrIsLead } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";

/**
 * Revoke an accepted plan. Sends the plan back to draft so it can be edited
 * and (re-)accepted later. Project records on the plan remain in their draft
 * state — acceptance no longer promotes drafts (that now happens on finalize),
 * so there is nothing to demote.
 *
 * Finalized plans cannot be revoked.
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

  // Defensive: if any project on the plan is somehow no longer a draft (e.g.
  // manually flipped), refuse to revoke so we don't leave the plan in a state
  // that contradicts live work.
  const nonDraft = await ProjectModel.find({
    clientId: id,
    planId,
    status: { $ne: "draft" },
  }).lean();
  if (nonDraft.length > 0) {
    const titles = nonDraft.map((p) => `"${p.title}"`).join(", ");
    return NextResponse.json(
      {
        error: `Cannot revoke: ${nonDraft.length} project${nonDraft.length === 1 ? " is" : "s are"} no longer in draft (${titles}). Reset ${nonDraft.length === 1 ? "it" : "them"} first.`,
      },
      { status: 400 }
    );
  }

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
    metadata: { planId, title: plan.title },
  });

  return NextResponse.json({
    id: updated!._id.toString(),
    status: updated!.status,
    acceptedAt: null,
    acceptedBy: null,
    acceptedByClient: null,
  });
}
