import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";

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
  if (plan.status === "finalized") {
    return NextResponse.json({ error: "This proposal has already been finalized" }, { status: 400 });
  }

  const draftCount = await ProjectModel.countDocuments({
    clientId: plan.clientId,
    planId: plan._id.toString(),
    status: "draft",
  });
  if (draftCount === 0) {
    return NextResponse.json({ error: "Proposal has no projects to accept" }, { status: 400 });
  }

  const todayIso = new Date().toISOString().split("T")[0];

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
      projectCount: draftCount,
      acceptorEmail: email,
    },
  });

  return NextResponse.json({ success: true, status: "accepted", acceptedAt: todayIso });
}
