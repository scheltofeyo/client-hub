import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel, type ISurveySubmission } from "@/lib/models/SurveySubmission";

/** A submission already exists for this email in this session: resume it, or refuse once it is in. */
function respondToExisting(existing: ISurveySubmission) {
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
  }).lean<ISurveySubmission>();

  if (existing) return respondToExisting(existing);

  try {
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
  } catch (err: unknown) {
    // Lost a race with a second request for the same email in this session (the
    // unique index is per session): it is the same participant, so resume theirs.
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      const winner = await SurveySubmissionModel.findOne({
        sessionId,
        participantEmail,
      }).lean<ISurveySubmission>();
      if (winner) return respondToExisting(winner);
    }
    throw err;
  }
}
