import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";

/**
 * Public: poll endpoint — returns session status.
 *
 * With `?submission=<id>` it also reports whether that submission still exists,
 * so a participant whose entry was removed by the facilitator is sent back to
 * the start instead of waiting on a match that will never come.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const doc = await RankingSessionModel.findOne({ shareCode }).select("status").lean();
  if (!doc) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const submissionId = req.nextUrl.searchParams.get("submission");
  if (!submissionId || !isValidObjectId(submissionId)) {
    return NextResponse.json({ status: doc.status });
  }

  const exists = await RankingSubmissionModel.exists({
    _id: submissionId,
    sessionId: doc._id.toString(),
  });

  return NextResponse.json({ status: doc.status, submissionExists: !!exists });
}
