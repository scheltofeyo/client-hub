import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const surveySession = await SurveySessionModel.findById(id).select("createdBy").lean();
  if (!surveySession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = surveySession.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.viewOthers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await SurveySubmissionModel.find({ sessionId: id })
    .sort({ createdAt: 1 })
    .select("participantName participantEmail status submittedAt createdAt")
    .lean();

  return NextResponse.json(
    submissions.map((s) => ({
      id: s._id.toString(),
      participantName: s.participantName,
      participantEmail: s.participantEmail,
      status: s.status,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      createdAt: s.createdAt?.toISOString(),
    }))
  );
}
