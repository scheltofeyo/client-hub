import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { sanitizeAnswersForSave, type IncomingAnswer } from "@/lib/surveys/answer-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const surveySession = await SurveySessionModel.findOne({ shareCode }).lean();
  if (!surveySession) return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  if (surveySession.status !== "open") {
    return NextResponse.json({ error: "Survey is not open" }, { status: 400 });
  }

  const body = await req.json();
  const submissionId: string = body.submissionId;
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const submission = await SurveySubmissionModel.findById(submissionId);
  if (!submission || submission.sessionId !== surveySession._id.toString()) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  if (submission.status === "completed") {
    return NextResponse.json({ error: "Submission already completed" }, { status: 409 });
  }

  const sections = surveySession.templateSnapshot.sections ?? [];
  const rankWeights = surveySession.templateSnapshot.rankWeights ?? [5, 4, 3, 2, 1];
  const incomingAnswers: IncomingAnswer[] = Array.isArray(body.answers) ? body.answers : [];
  const sanitized = sanitizeAnswersForSave(incomingAnswers, sections, rankWeights);

  submission.set({ answers: sanitized });
  await submission.save();

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
