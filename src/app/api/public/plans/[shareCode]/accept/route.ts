import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";
import type { TaskAssignee } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });

  await connectDB();
  const plan = await ProjectPlanModel.findOne({ shareCode }).lean();
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (plan.status === "accepted") {
    return NextResponse.json({ error: "This proposal has already been accepted" }, { status: 400 });
  }
  if (plan.status === "archived") {
    return NextResponse.json({ error: "This proposal is no longer available" }, { status: 400 });
  }

  const drafts = await ProjectModel.find({
    clientId: plan.clientId,
    planId: plan._id.toString(),
    status: "draft",
  }).lean();
  if (drafts.length === 0) {
    return NextResponse.json({ error: "Proposal has no projects to promote" }, { status: 400 });
  }

  const todayIso = new Date().toISOString().split("T")[0];

  // Promote drafts → not_started, merge role-assigned users into project.members
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

  await ProjectPlanModel.findByIdAndUpdate(plan._id, {
    $set: {
      status: "accepted",
      acceptedAt: todayIso,
      acceptedByClient: { name, email },
    },
    $push: {
      acceptanceLog: {
        type: "accepted",
        at: new Date().toISOString(),
        source: "client",
        by: { name, email },
      },
    },
  });

  await recordActivity({
    clientId: plan.clientId,
    actorId: "public",
    actorName: `${name} (${email})`,
    type: "plan.accepted_by_client",
    metadata: {
      planId: plan._id.toString(),
      title: plan.title,
      projectCount: drafts.length,
      acceptorEmail: email,
    },
  });

  return NextResponse.json({ success: true, status: "accepted", acceptedAt: todayIso });
}
