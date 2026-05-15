import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { ensureUniqueShareCode } from "@/lib/share-codes";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { ClientModel } from "@/lib/models/Client";
import { UserModel } from "@/lib/models/User";
import { snapshotQuestionFrom } from "@/lib/surveys/serializers";
import { normalizeQuestionType } from "@/lib/surveys/types";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  await connectDB();
  const filter = hasPermission(session, "tools.surveys.viewOthers")
    ? {}
    : { createdBy: session!.user.id };

  const sessions = await SurveySessionModel.find(filter)
    .sort({ createdAt: -1 })
    .select("clientId templateId title status shareCode createdBy openedAt closedAt createdAt templateSnapshot.name")
    .lean();

  const sessionIds = sessions.map((s) => s._id.toString());
  const [counts, clients, creators] = await Promise.all([
    SurveySubmissionModel.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $group: { _id: "$sessionId", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]),
    ClientModel.find({ _id: { $in: [...new Set(sessions.map((s) => s.clientId))] } })
      .select("company")
      .lean(),
    UserModel.find({ _id: { $in: [...new Set(sessions.map((s) => s.createdBy))] } })
      .select("name image")
      .lean(),
  ]);
  const countMap = new Map(counts.map((c) => [c._id, { total: c.total, completed: c.completed }]));
  const clientMap = new Map(clients.map((c) => [c._id.toString(), c.company]));
  const creatorMap = new Map(creators.map((u) => [u._id.toString(), { name: u.name, image: u.image }]));

  return NextResponse.json(
    sessions.map((s) => ({
      id: s._id.toString(),
      clientId: s.clientId,
      clientName: clientMap.get(s.clientId) ?? "Unknown",
      templateId: s.templateId,
      templateName: s.templateSnapshot?.name ?? "(deleted template)",
      title: s.title,
      status: s.status,
      shareCode: s.shareCode,
      submissionCount: countMap.get(s._id.toString())?.total ?? 0,
      completedCount: countMap.get(s._id.toString())?.completed ?? 0,
      createdBy: s.createdBy,
      createdByName: creatorMap.get(s.createdBy)?.name ?? "Unknown",
      createdByImage: creatorMap.get(s.createdBy)?.image ?? null,
      createdAt: s.createdAt?.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  await connectDB();

  const body = await req.json();
  const { clientId, templateId, title, fromScratch } = body;
  if (!clientId || !title?.trim()) {
    return NextResponse.json(
      { error: "clientId and title are required" },
      { status: 400 }
    );
  }
  const isFromScratch = fromScratch === true || !templateId;

  const client = await ClientModel.findById(clientId).select("company").lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const shareCode = await ensureUniqueShareCode((code) =>
    SurveySessionModel.exists({ shareCode: code })
  );

  if (isFromScratch) {
    const doc = await SurveySessionModel.create({
      clientId,
      templateId: "",
      templateSnapshot: {
        name: title.trim(),
        archetypes: [],
        rankWeights: [5, 4, 3, 2, 1],
        sections: [],
      },
      title: title.trim(),
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

  const [template, sections, questions] = await Promise.all([
    SurveyTemplateModel.findById(templateId).lean(),
    SurveyTemplateSectionModel.find({ templateId }).sort({ order: 1, createdAt: 1 }).lean(),
    SurveyTemplateQuestionModel.find({ templateId }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (template.status !== "active") {
    return NextResponse.json({ error: "Template is archived" }, { status: 400 });
  }
  if (sections.length === 0 || questions.length === 0) {
    return NextResponse.json({ error: "Template has no sections or questions yet" }, { status: 400 });
  }
  // Archetypes only required if at least one archetype-ranking question is present
  const hasArchetypeRanking = questions.some(
    (q) => normalizeQuestionType(q.type) === "archetype-ranking"
  );
  if (hasArchetypeRanking && (!Array.isArray(template.archetypeIds) || template.archetypeIds.length < 2)) {
    return NextResponse.json({ error: "Template has no archetypes set" }, { status: 400 });
  }

  // Snapshot only the archetype id — name + color are resolved live from the
  // Archetype collection at read time so renames/recolors propagate to
  // historical sessions. See `enrichArchetypes()` in src/lib/surveys/.
  const archetypes = template.archetypeIds.map((id) => ({ id }));

  const questionsBySection = new Map<string, typeof questions>();
  for (const q of questions) {
    const arr = questionsBySection.get(q.sectionId) ?? [];
    arr.push(q);
    questionsBySection.set(q.sectionId, arr);
  }

  const sectionSnapshots = sections.map((s) => ({
    id: s._id.toString(),
    title: s.title,
    description: s.description ?? undefined,
    imageUrl: s.imageUrl ?? undefined,
    order: s.order ?? 0,
    openQuestion: s.openQuestion ?? undefined,
    questions: (questionsBySection.get(s._id.toString()) ?? []).map((q) => snapshotQuestionFrom(q)),
  }));

  const doc = await SurveySessionModel.create({
    clientId,
    templateId,
    templateSnapshot: {
      name: template.name,
      description: template.description ?? undefined,
      archetypes,
      rankWeights: template.defaultRankWeights ?? [5, 4, 3, 2, 1],
      closingOpenQuestion: template.closingOpenQuestion ?? undefined,
      sections: sectionSnapshots,
    },
    title: title.trim(),
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
