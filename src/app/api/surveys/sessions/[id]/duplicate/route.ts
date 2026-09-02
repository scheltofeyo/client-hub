import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { ensureUniqueShareCode } from "@/lib/share-codes";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";
import {
  CULTURAL_SELECT,
  culturalSnapshotFromClient,
  respondentVariableFromLevels,
} from "@/lib/surveys/cultural-dna";
import { isValueBackedType } from "@/lib/surveys/types";
import { randomUUID } from "node:crypto";

/**
 * Copy a session into a fresh draft — same content, no submissions, own share code.
 *
 * The copy is of the *snapshot*, not of the template the original was built from:
 * a session's content is routinely edited after creation, and re-instantiating the
 * template would silently hand back a different survey than the one being copied.
 *
 * A different client may be chosen, which is the interesting case: the snapshot's
 * Cultural DNA is client-owned, so it is re-taken from the target client and every
 * value-backed question re-materialised against it — exactly as session creation
 * does. Copying the source client's values into another client's survey would
 * quietly ask people about a company that is not theirs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const source = await SurveySessionModel.findById(id).lean();
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Duplicating reproduces the whole snapshot, so it needs the same right the
  // detail view needs — not the right to edit the original, which the copy leaves
  // untouched.
  const isOwner = source.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.viewOthers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetClientId =
    typeof body.clientId === "string" && body.clientId.trim()
      ? body.clientId.trim()
      : source.clientId;
  const title = String(body.title ?? "").trim() || `${source.title} (copy)`;

  const client = await ClientModel.findById(targetClientId)
    .select(`company ${CULTURAL_SELECT}`)
    .lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const snapshot = source.templateSnapshot ?? {
    name: title,
    archetypes: [],
    culturalValues: [],
    culturalLevels: [],
    rankWeights: [5, 4, 3, 2, 1],
    top3Weights: [5, 3, 1],
    sections: [],
  };
  const sections = snapshot.sections ?? [];
  const hasValueBacked = sections.some((s) =>
    (s.questions ?? []).some((q) => isValueBackedType(q.type))
  );

  const sameClient = targetClientId === source.clientId;

  let culturalValues = snapshot.culturalValues ?? [];
  let culturalLevels = snapshot.culturalLevels ?? [];
  let nextSections = sections;
  let respondentVariable = source.respondentVariable ?? undefined;

  if (!sameClient) {
    const cultural = culturalSnapshotFromClient(client);
    if (hasValueBacked && cultural.culturalValues.length === 0) {
      return NextResponse.json(
        {
          error:
            "This survey uses the client's Cultural DNA, but the client you picked has no cultural values yet. Add them on that client's Content tab first.",
        },
        { status: 400 }
      );
    }
    culturalValues = cultural.culturalValues;
    culturalLevels = cultural.culturalLevels;
    // Fresh item ids: these are the target client's values, and nothing has been
    // answered against the copy yet.
    nextSections = sections.map((s) => ({
      ...s,
      questions: (s.questions ?? []).map((q) =>
        isValueBackedType(q.type)
          ? {
              ...q,
              valueItems: cultural.culturalValues.map((v) => ({
                id: randomUUID(),
                valueId: v.id,
              })),
            }
          : q
      ),
    }));
    // The level options belong to the target client too; the authored copy around
    // them travels with the survey.
    respondentVariable = source.respondentVariable?.enabled
      ? respondentVariableFromLevels(cultural.culturalLevels, {
          enabled: true,
          key: source.respondentVariable.key,
          label: source.respondentVariable.label,
          helpText: source.respondentVariable.helpText,
          helpUrl: source.respondentVariable.helpUrl,
          required: source.respondentVariable.required,
        })
      : undefined;
  }

  const shareCode = await ensureUniqueShareCode((code) =>
    SurveySessionModel.exists({ shareCode: code })
  );

  const doc = await SurveySessionModel.create({
    clientId: targetClientId,
    templateId: source.templateId,
    templateSnapshot: {
      ...snapshot,
      culturalValues,
      culturalLevels,
      sections: nextSections,
    },
    respondentVariable,
    // Analyses reference question ids, which the copy preserves, so they keep
    // resolving against the copied snapshot.
    analyses: source.analyses ?? [],
    title,
    status: "draft",
    shareCode,
    createdBy: session!.user.id,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      clientId: doc.clientId,
      templateId: doc.templateId,
      title: doc.title,
      status: doc.status,
      shareCode: doc.shareCode,
      createdAt: doc.createdAt?.toISOString(),
    },
    { status: 201 }
  );
}
