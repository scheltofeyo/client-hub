import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";

type TemplateLike = {
  _id: { toString(): string };
  name: string;
  description?: string;
  status: string;
  archetypeIds?: string[];
  defaultRankWeights?: number[];
  closingOpenQuestion?: unknown;
  version?: number;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
};

function serializeTemplate(doc: TemplateLike) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? undefined,
    status: doc.status,
    archetypeIds: doc.archetypeIds ?? [],
    defaultRankWeights: doc.defaultRankWeights ?? [5, 4, 3, 2, 1],
    closingOpenQuestion: doc.closingOpenQuestion ?? undefined,
    version: doc.version ?? 1,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt?.toISOString?.(),
    updatedAt: doc.updatedAt?.toISOString?.(),
  };
}

export async function GET() {
  const session = await auth();
  // Admins managing templates see everything; tool-users see only active templates (so they can pick one for a new session).
  const isAdmin = hasPermission(session, "admin.surveys.manageTemplates");
  if (!isAdmin) {
    const forbidden = requirePermission(session, "tools.surveys.access");
    if (forbidden) return forbidden;
  }

  await connectDB();
  const filter = isAdmin ? {} : { status: "active" };
  const docs = await SurveyTemplateModel.find(filter).sort({ createdAt: -1 }).lean();
  const templateIds = docs.map((d) => d._id.toString());
  const [sectionCounts, questionCounts] = await Promise.all([
    SurveyTemplateSectionModel.aggregate([
      { $match: { templateId: { $in: templateIds } } },
      { $group: { _id: "$templateId", count: { $sum: 1 } } },
    ]),
    SurveyTemplateQuestionModel.aggregate([
      { $match: { templateId: { $in: templateIds } } },
      { $group: { _id: "$templateId", count: { $sum: 1 } } },
    ]),
  ]);
  const sectionMap = new Map(sectionCounts.map((c) => [c._id, c.count]));
  const questionMap = new Map(questionCounts.map((c) => [c._id, c.count]));

  return NextResponse.json(
    docs.map((d) => ({
      ...serializeTemplate(d),
      sectionCount: sectionMap.get(d._id.toString()) ?? 0,
      questionCount: questionMap.get(d._id.toString()) ?? 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  await connectDB();
  const body = await req.json();
  const { name, description, archetypeIds, defaultRankWeights } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Array.isArray(archetypeIds) || archetypeIds.length < 2) {
    return NextResponse.json(
      { error: "Pick at least 2 archetypes for this template" },
      { status: 400 }
    );
  }

  const weights =
    Array.isArray(defaultRankWeights) && defaultRankWeights.length === archetypeIds.length
      ? defaultRankWeights.map((w: unknown) => Number(w))
      : Array.from({ length: archetypeIds.length }, (_, i) => archetypeIds.length - i);

  const doc = await SurveyTemplateModel.create({
    name: name.trim(),
    description: description?.trim() || undefined,
    status: "active",
    archetypeIds,
    defaultRankWeights: weights,
    version: 1,
    createdBy: session!.user.id,
  });

  return NextResponse.json(serializeTemplate(doc.toObject()), { status: 201 });
}
