import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { ClientModel } from "@/lib/models/Client";
import { UserModel } from "@/lib/models/User";
import { enrichArchetypes } from "@/lib/surveys/enrich-archetypes";
import {
  CULTURAL_SELECT,
  culturalSnapshotFromClient,
  effectiveRespondentVariable,
  respondentVariableFromLevels,
} from "@/lib/surveys/cultural-dna";
import { normalizeRespondentVariableCopy } from "@/lib/surveys/respondent-variable-copy";
import { isValueBackedType } from "@/lib/surveys/types";
import { normalizeWelcomeScreen } from "@/lib/surveys/welcome-screen";
import { normalizeClosingScreen } from "@/lib/surveys/closing-screen";
import { randomUUID } from "node:crypto";

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
    templateSnapshot: {
      ...doc.templateSnapshot,
      archetypes: enrichedArchetypes,
      top3Weights: doc.templateSnapshot?.top3Weights ?? [5, 3, 1],
    },
    // The effective one rather than the stored one: a session with value-backed
    // questions is asked the level even when nothing was ever stored, and the
    // editor has to show that step for the same reason the runner renders it.
    respondentVariable: effectiveRespondentVariable(doc) ?? null,
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
  if (body.top3Weights !== undefined) {
    if (
      !Array.isArray(body.top3Weights) ||
      body.top3Weights.length !== 3 ||
      body.top3Weights.some((w: unknown) => !Number.isFinite(Number(w)))
    ) {
      return NextResponse.json(
        { error: "top3Weights must be 3 numbers" },
        { status: 400 }
      );
    }
    update["templateSnapshot.top3Weights"] = body.top3Weights.map((w: unknown) => Number(w));
  }

  // Snapshot content edits are only allowed in draft. Once published the
  // snapshot is frozen (rankWeights remain editable above — they don't
  // change snapshot content).
  const snapshotEditsRequested =
    body.snapshotName !== undefined ||
    body.snapshotDescription !== undefined ||
    body.snapshotSections !== undefined ||
    body.snapshotArchetypes !== undefined ||
    body.snapshotClosingOpenQuestion !== undefined ||
    body.snapshotThankYouText !== undefined ||
    body.snapshotWelcomeScreen !== undefined ||
    body.snapshotClosingScreen !== undefined ||
    body.respondentVariable !== undefined ||
    body.refreshCulturalDna === true;
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
  if (body.snapshotArchetypes !== undefined) {
    if (!Array.isArray(body.snapshotArchetypes)) {
      return NextResponse.json({ error: "snapshotArchetypes must be an array" }, { status: 400 });
    }
    update["templateSnapshot.archetypes"] = body.snapshotArchetypes
      .filter((a: { id?: unknown }) => typeof a?.id === "string" && a.id.length > 0)
      .map((a: { id: string }) => ({ id: a.id }));
  }
  if (body.snapshotThankYouText !== undefined) {
    // `null`, not `undefined`: Mongoose drops undefined from a $set, and this
    // field is now retired in favour of `closingScreen` — the editor sends an
    // empty value to hand over, with the old text already folded into the body.
    update["templateSnapshot.thankYouText"] =
      String(body.snapshotThankYouText).trim() || null;
  }
  if (body.snapshotClosingScreen !== undefined) {
    update["templateSnapshot.closingScreen"] =
      normalizeClosingScreen(body.snapshotClosingScreen) ?? null;
  }
  if (body.snapshotWelcomeScreen !== undefined) {
    // Explicit null rather than undefined: Mongoose drops undefined from a $set,
    // which would leave previously authored copy in place when it was cleared.
    update["templateSnapshot.welcomeScreen"] =
      normalizeWelcomeScreen(body.snapshotWelcomeScreen) ?? null;
  }
  if (body.respondentVariable !== undefined) {
    // Only the copy is taken from the body. The options are the client's cultural
    // levels — accepting them from the editor would let a typo create a level no
    // behaviour is filed under, which shows that participant nothing at all.
    const copy = normalizeRespondentVariableCopy(body.respondentVariable);
    // The snapshot's levels are the source, falling back to the options already
    // stored: a session whose snapshot predates `culturalLevels` still has them
    // on the variable itself, and rebuilding from an empty list would silently
    // remove a step the survey is running with.
    const levels = existing.templateSnapshot?.culturalLevels?.length
      ? existing.templateSnapshot.culturalLevels
      : (existing.respondentVariable?.options ?? []).map((o) => o.id);
    const rebuilt = respondentVariableFromLevels(levels, {
      enabled: true,
      key: existing.respondentVariable?.key || "culturalLevel",
      label: copy.label ?? "",
      helpText: copy.helpText,
      helpUrl: copy.helpUrl,
      required: copy.required !== false,
    });
    // Explicit null: Mongoose drops undefined from a $set, which would leave
    // stale copy in place when every field was cleared.
    update.respondentVariable = rebuilt ?? null;
  }
  // Re-copy the client's Cultural DNA into the snapshot. Draft-only via the guard
  // above: re-materialising values under answers that already reference them would
  // orphan those answers.
  if (body.refreshCulturalDna === true) {
    const client = await ClientModel.findById(existing.clientId)
      .select(CULTURAL_SELECT)
      .lean();
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const cultural = culturalSnapshotFromClient(client);
    update["templateSnapshot.culturalValues"] = cultural.culturalValues;
    update["templateSnapshot.culturalLevels"] = cultural.culturalLevels;

    // Re-materialise the items of every value-backed question. Without this the
    // snapshot would list new values that no question asks about, and keep asking
    // about values the client has removed.
    //
    // Item ids are preserved where the value is unchanged, so answers already
    // saved by someone mid-flight keep pointing at the same item.
    const sections = existing.templateSnapshot?.sections ?? [];
    const rebuiltSections = sections.map((section) => ({
      ...section,
      questions: (section.questions ?? []).map((q) => {
        if (!isValueBackedType(q.type)) return q;
        const existingIdByValue = new Map(
          (q.valueItems ?? []).map((item) => [item.valueId, item.id])
        );
        return {
          ...q,
          valueItems: cultural.culturalValues.map((v) => ({
            id: existingIdByValue.get(v.id) ?? randomUUID(),
            valueId: v.id,
          })),
        };
      }),
    }));
    update["templateSnapshot.sections"] = rebuiltSections;

    // The level options are derived from the same DNA, so they move with it.
    if (existing.respondentVariable?.enabled) {
      const rebuilt = respondentVariableFromLevels(cultural.culturalLevels, {
        enabled: true,
        key: existing.respondentVariable.key,
        label: existing.respondentVariable.label,
        helpText: existing.respondentVariable.helpText,
        helpUrl: existing.respondentVariable.helpUrl,
        required: existing.respondentVariable.required,
      });
      // Explicit null rather than undefined: the client may have removed all its
      // levels, and Mongoose drops undefined from a $set, which would leave the
      // old options in place and offer levels the client no longer has.
      update.respondentVariable = rebuilt ?? null;
    }
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
