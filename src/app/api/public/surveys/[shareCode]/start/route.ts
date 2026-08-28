import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const surveySession = await SurveySessionModel.findOne({ shareCode })
    .select("_id status")
    .lean();
  if (!surveySession) return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  if (surveySession.status !== "open") {
    return NextResponse.json({ error: "Survey is not open" }, { status: 400 });
  }

  const body = await req.json();
  const participantEmail = String(body.participantEmail ?? "").trim().toLowerCase();
  if (!participantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participantEmail)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const sessionId = surveySession._id.toString();
  const existing = await SurveySubmissionModel.findOne({
    sessionId,
    participantEmail,
  }).lean();

  if (existing) {
    if (existing.status === "completed") {
      return NextResponse.json(
        { error: "This email has already submitted the survey" },
        { status: 409 }
      );
    }
    // The level is chosen on the screen after this one, so nothing to store here —
    // but a returning participant needs theirs back, or they would be shown a
    // different level's behaviours than the ones they originally scored.
    return NextResponse.json({
      submissionId: existing._id.toString(),
      status: existing.status,
      resumed: true,
      answers: existing.answers ?? [],
      cohortTags: existing.cohortTags ?? undefined,
    });
  }

  const created = await SurveySubmissionModel.create({
    sessionId,
    participantName: "",
    participantEmail,
    status: "in_progress",
    answers: [],
    sectionOpenAnswers: [],
  });

  return NextResponse.json(
    {
      submissionId: created._id.toString(),
      status: created.status,
      resumed: false,
    },
    { status: 201 }
  );
}
