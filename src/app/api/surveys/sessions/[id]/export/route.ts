import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { computeSurveyResults } from "@/lib/surveys/compute-results";
import { buildSurveyResultsMarkdown } from "@/lib/surveys/export-markdown";
import { slugify } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const surveySession = await SurveySessionModel.findById(id).lean();
  if (!surveySession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = surveySession.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.viewOthers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await SurveySubmissionModel.find({
    sessionId: id,
    status: "completed",
  }).lean();

  const { results, questionMetas, archetypes } = await computeSurveyResults(
    surveySession,
    submissions
  );

  const markdown = buildSurveyResultsMarkdown({
    session: surveySession,
    archetypes,
    results,
    submissions,
    questionMetas,
  });

  const filename = `${slugify(surveySession.title) || "survey"}-results.md`;
  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
