import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { getArchetypes } from "@/lib/data";
import AdminSurveyTemplatesTable from "./AdminSurveyTemplatesTable";

export default async function AdminSurveyTemplatesPage() {
  const session = await auth();
  if (!hasPermission(session, "admin.surveys.manageTemplates")) redirect("/dashboard");

  await connectDB();
  const [templates, archetypes] = await Promise.all([
    SurveyTemplateModel.find().sort({ createdAt: -1 }).lean(),
    getArchetypes(),
  ]);

  const templateIds = templates.map((t) => t._id.toString());
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

  const initialTemplates = templates.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    description: t.description ?? undefined,
    status: t.status,
    archetypeIds: t.archetypeIds ?? [],
    sectionCount: sectionMap.get(t._id.toString()) ?? 0,
    questionCount: questionMap.get(t._id.toString()) ?? 0,
    createdAt: t.createdAt?.toISOString(),
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <AdminSurveyTemplatesTable
        initialTemplates={initialTemplates}
        archetypes={archetypes}
      />
    </div>
  );
}
