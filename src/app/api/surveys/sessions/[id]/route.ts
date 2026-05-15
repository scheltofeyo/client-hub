import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { ClientModel } from "@/lib/models/Client";
import { UserModel } from "@/lib/models/User";
import { enrichArchetypes } from "@/lib/surveys/enrich-archetypes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const doc = await SurveySessionModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = doc.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.viewOthers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [submissionCount, completedCount, creator, client, enrichedArchetypes] = await Promise.all([
    SurveySubmissionModel.countDocuments({ sessionId: id }),
    SurveySubmissionModel.countDocuments({ sessionId: id, status: "completed" }),
    UserModel.findById(doc.createdBy).select("name image").lean(),
    ClientModel.findById(doc.clientId).select("company").lean(),
    enrichArchetypes(doc.templateSnapshot?.archetypes ?? []),
  ]);

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    clientName: client?.company ?? null,
    templateId: doc.templateId,
    templateSnapshot: { ...doc.templateSnapshot, archetypes: enrichedArchetypes },
    title: doc.title,
    status: doc.status,
    shareCode: doc.shareCode,
    createdBy: doc.createdBy,
    createdByName: creator?.name ?? "Unknown",
    createdByImage: creator?.image ?? null,
    submissionCount,
    completedCount,
    openedAt: doc.openedAt?.toISOString() ?? null,
    closedAt: doc.closedAt?.toISOString() ?? null,
    createdAt: doc.createdAt?.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const existing = await SurveySessionModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.status !== undefined) {
    if (body.status === "open") {
      const questionCount = (existing.templateSnapshot?.sections ?? []).reduce(
        (sum, s) => sum + (s.questions?.length ?? 0),
        0
      );
      if (questionCount === 0) {
        return NextResponse.json(
          { error: "Add at least one question before publishing the survey." },
          { status: 400 }
        );
      }
    }
    update.status = body.status;
    if (body.status === "open" && !existing.openedAt) update.openedAt = new Date();
    if (body.status === "closed") update.closedAt = new Date();
  }
  if (body.rankWeights !== undefined) {
    const expectedLength = existing.templateSnapshot?.archetypes?.length ?? 0;
    if (
      !Array.isArray(body.rankWeights) ||
      body.rankWeights.length !== expectedLength ||
      body.rankWeights.some((w: unknown) => !Number.isFinite(Number(w)))
    ) {
      return NextResponse.json(
        { error: `rankWeights must be ${expectedLength} numbers` },
        { status: 400 }
      );
    }
    // Nested-path update on the embedded snapshot.
    update["templateSnapshot.rankWeights"] = body.rankWeights.map((w: unknown) => Number(w));
  }

  // Snapshot content edits are only allowed in draft. Once published the
  // snapshot is frozen (rankWeights remain editable above — they don't
  // change snapshot content).
  const snapshotEditsRequested =
    body.snapshotName !== undefined ||
    body.snapshotDescription !== undefined ||
    body.snapshotSections !== undefined ||
    body.snapshotClosingOpenQuestion !== undefined;
  if (snapshotEditsRequested && existing.status !== "draft") {
    return NextResponse.json(
      { error: "Snapshot content can only be edited while the session is in draft." },
      { status: 400 }
    );
  }
  if (body.snapshotName !== undefined) {
    const v = String(body.snapshotName).trim();
    if (!v) return NextResponse.json({ error: "Snapshot name cannot be empty" }, { status: 400 });
    update["templateSnapshot.name"] = v;
  }
  if (body.snapshotDescription !== undefined) {
    update["templateSnapshot.description"] = String(body.snapshotDescription).trim() || undefined;
  }
  if (body.snapshotClosingOpenQuestion !== undefined) {
    update["templateSnapshot.closingOpenQuestion"] = body.snapshotClosingOpenQuestion;
  }
  if (body.snapshotSections !== undefined) {
    if (!Array.isArray(body.snapshotSections)) {
      return NextResponse.json({ error: "snapshotSections must be an array" }, { status: 400 });
    }
    update["templateSnapshot.sections"] = body.snapshotSections;
  }

  const doc = await SurveySessionModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    status: doc.status,
    openedAt: doc.openedAt?.toISOString() ?? null,
    closedAt: doc.closedAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const existing = await SurveySessionModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.deleteAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Promise.all([
    SurveySessionModel.findByIdAndDelete(id),
    SurveySubmissionModel.deleteMany({ sessionId: id }),
  ]);

  return NextResponse.json({ success: true });
}
