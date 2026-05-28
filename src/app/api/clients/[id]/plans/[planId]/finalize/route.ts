import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { hasPermission } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";
import type { TaskAssignee } from "@/types";

/**
 * Finalize an accepted plan. Irreversible: promotes all draft projects on
 * the plan to "not_started", merges role-allocation users into project members,
 * and flips the plan to status "finalized". Once finalized, the plan can no
 * longer be revoked, accepted, or edited.
 *
 * Finalize is intentionally NOT lead-eligible — it's a definitive admin-level
 * action separate from accept.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session, "projectPlans.finalize")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, planId } = await params;
  await connectDB();
  const [client, plan] = await Promise.all([
    ClientModel.findById(id).lean(),
    ProjectPlanModel.findOne({ _id: planId, clientId: id }).lean(),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  if (plan.status !== "accepted") {
    return NextResponse.json(
      { error: "Only accepted plans can be finalized" },
      { status: 400 }
    );
  }

  const drafts = await ProjectModel.find({ clientId: id, planId, status: "draft" }).lean();
  if (drafts.length === 0) {
    return NextResponse.json({ error: "Plan has no draft projects to promote" }, { status: 400 });
  }

  const todayIso = new Date().toISOString().split("T")[0];

  // Promote each draft: status → not_started, merge assignedUser from role
  // allocation lines into project.members
  await Promise.all(
    drafts.map(async (draft) => {
      const existingMembers: TaskAssignee[] = Array.isArray(draft.members)
        ? draft.members.map((m) => ({ userId: m.userId, name: m.name, image: m.image ?? undefined }))
        : [];
      const assigned: TaskAssignee[] = [];
      for (const line of draft.roleAllocation ?? []) {
        const u = line.assignedUser;
        if (u && u.userId) {
          assigned.push({ userId: u.userId, name: u.name, image: u.image ?? undefined });
        }
      }
      const seen = new Set<string>();
      const merged: TaskAssignee[] = [];
      for (const m of [...existingMembers, ...assigned]) {
        if (seen.has(m.userId)) continue;
        seen.add(m.userId);
        merged.push(m);
      }
      await ProjectModel.findByIdAndUpdate(draft._id, {
        $set: { status: "not_started", members: merged },
      });
    })
  );

  const finalizer = {
    userId: session.user.id,
    name: session.user.name ?? "Unknown",
    image: session.user.image ?? undefined,
  };

  const updated = await ProjectPlanModel.findByIdAndUpdate(
    planId,
    {
      $set: {
        status: "finalized",
        finalizedAt: todayIso,
        finalizedBy: finalizer,
      },
      $push: {
        acceptanceLog: {
          type: "finalized",
          at: new Date().toISOString(),
          source: "internal",
          by: finalizer,
        },
      },
    },
    { new: true }
  ).lean();

  await recordActivity({
    clientId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "plan.finalized",
    metadata: { planId, title: plan.title, projectCount: drafts.length },
  });

  return NextResponse.json({
    id: updated!._id.toString(),
    status: updated!.status,
    finalizedAt: updated!.finalizedAt,
    finalizedBy: updated!.finalizedBy,
    promotedProjectIds: drafts.map((d) => d._id.toString()),
  });
}
