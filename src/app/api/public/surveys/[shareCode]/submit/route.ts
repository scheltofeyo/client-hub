import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { validateAnswers, type IncomingAnswer } from "@/lib/surveys/answer-validation";
import { sanitizeCohortTags, effectiveRespondentVariable } from "@/lib/surveys/cultural-dna";

type IncomingSectionAnswer = {
  sectionId: string;
  text: string;
};

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
  const result = validateAnswers(incomingAnswers, sections, rankWeights);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Legacy section/closing open answers (pre-migration sessions still carry these)
  const validSectionIds = new Set(sections.map((s) => s.id));
  const incomingSectionAnswers: IncomingSectionAnswer[] = Array.isArray(body.sectionOpenAnswers)
    ? body.sectionOpenAnswers
    : [];
  const validatedSectionAnswers = incomingSectionAnswers
    .filter((s) => validSectionIds.has(s.sectionId) && typeof s.text === "string" && s.text.trim())
    .map((s) => ({ sectionId: s.sectionId, text: s.text.trim() }));

  const closingOpenAnswer =
    typeof body.closingOpenAnswer === "string" && body.closingOpenAnswer.trim()
      ? body.closingOpenAnswer.trim()
      : undefined;

  // Submit is the binding check: a required respondent variable must be present and
  // known, because it is what decided which behaviours this person was scoring and
  // which segment the answers land in.
  // `cohortTags` is a Mongoose Map on a hydrated document but a plain object on a
  // .lean() read, and the generated type only describes the latter — hence the guard.
  const storedTags: unknown = submission.cohortTags;
  const storedCohort: Record<string, string> =
    storedTags instanceof Map
      ? (Object.fromEntries(storedTags) as Record<string, string>)
      : ((storedTags ?? {}) as Record<string, string>);
  const cohort = sanitizeCohortTags(
    body.cohortTags ?? storedCohort,
    effectiveRespondentVariable(surveySession)
  );
  if (!cohort.ok) {
    return NextResponse.json({ error: cohort.error }, { status: 400 });
  }

  submission.set({
    answers: result.answers,
    ...(cohort.tags ? { cohortTags: cohort.tags } : {}),
    sectionOpenAnswers: validatedSectionAnswers,
    closingOpenAnswer,
    status: "completed",
    submittedAt: new Date(),
  });
  await submission.save();

  return NextResponse.json({
    submissionId: submission._id.toString(),
    status: submission.status,
    submittedAt: submission.submittedAt?.toISOString(),
  });
}
