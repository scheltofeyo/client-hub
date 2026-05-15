import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SurveyTemplateModel } from "@/lib/models/SurveyTemplate";
import { SurveyTemplateSectionModel } from "@/lib/models/SurveyTemplateSection";
import { SurveyTemplateQuestionModel } from "@/lib/models/SurveyTemplateQuestion";
import { getArchetypes } from "@/lib/data";
import { serializeQuestion } from "@/lib/surveys/serializers";
import TemplateEditor from "./TemplateEditor";

export default async function EditSurveyTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!hasPermission(session, "admin.surveys.manageTemplates")) redirect("/dashboard");

  const { id } = await params;
  await connectDB();

  const [template, sections, questions, allArchetypes] = await Promise.all([
    SurveyTemplateModel.findById(id).lean(),
    SurveyTemplateSectionModel.find({ templateId: id }).sort({ order: 1, createdAt: 1 }).lean(),
    SurveyTemplateQuestionModel.find({ templateId: id }).sort({ order: 1, createdAt: 1 }).lean(),
    getArchetypes(),
  ]);
  if (!template) notFound();

  return (
    <TemplateEditor
        templateId={id}
        initialTemplate={{
          name: template.name,
          description: template.description ?? "",
          status: template.status,
          archetypeIds: template.archetypeIds ?? [],
          defaultRankWeights: template.defaultRankWeights ?? [5, 4, 3, 2, 1],
          closingOpenQuestion: template.closingOpenQuestion
            ? { enabled: template.closingOpenQuestion.enabled, label: template.closingOpenQuestion.label }
            : { enabled: false, label: "" },
        }}
        initialSections={sections.map((s) => ({
          id: s._id.toString(),
          title: s.title,
          description: s.description ?? "",
          imageUrl: s.imageUrl ?? "",
          openQuestion: s.openQuestion
            ? { enabled: s.openQuestion.enabled, label: s.openQuestion.label }
            : { enabled: false, label: "" },
          order: s.order ?? 0,
        }))}
        initialQuestions={questions.map((q) => serializeQuestion(q))}
        archetypes={allArchetypes}
      />
  );
}
