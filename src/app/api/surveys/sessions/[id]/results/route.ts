import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import { computeSurveyResults } from "@/lib/surveys/compute-results";
import { listSegments, filterBySegment } from "@/lib/surveys/segments";
import { effectiveRespondentVariable } from "@/lib/surveys/cultural-dna";

export async function GET(
  req: NextRequest,
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

  const respondentVariable = effectiveRespondentVariable(surveySession);
  const segments = listSegments(submissions, respondentVariable);

  // Still validated rather than trusted, so an unknown segment is an error rather
  // than silently returning the whole group's numbers under a segment label.
  const requested = req.nextUrl.searchParams.get("segment");
  let activeSegment: string | null = null;
  let segmentLabel: string | null = null;
  let scoped = submissions;
  if (requested) {
    const match = segments.find((seg) => seg.value === requested);
    if (!match) {
      return NextResponse.json({ error: "Unknown segment" }, { status: 400 });
    }
    activeSegment = match.value;
    segmentLabel = match.label;
    scoped = filterBySegment(
      submissions,
      respondentVariable?.key || "culturalLevel",
      match.value
    );
  }

  const { results } = await computeSurveyResults(surveySession, scoped, {
    segments,
    activeSegment,
    segmentLabel,
  });
  return NextResponse.json(results);
}
