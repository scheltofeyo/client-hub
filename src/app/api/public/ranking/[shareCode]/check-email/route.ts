import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";

/** Public: check if email already has a submission for this session. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const session = await RankingSessionModel.findOne({ shareCode }).lean();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { email } = await req.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existing = await RankingSubmissionModel.findOne({
    sessionId: session._id.toString(),
    participantEmail: email.trim().toLowerCase(),
  }).lean();

  if (!existing) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    submission: {
      id: existing._id.toString(),
      status: existing.status,
      participantName: existing.participantName,
      rankings: existing.rankings,
    },
  });
}
