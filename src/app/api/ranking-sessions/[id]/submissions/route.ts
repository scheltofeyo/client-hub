import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  // Must be owner or have permission to view others' sessions
  const doc = await RankingSessionModel.findById(id).select("createdBy").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = doc.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.rankingValues")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await RankingSubmissionModel.find({ sessionId: id })
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json(
    submissions.map((s) => ({
      id: s._id.toString(),
      sessionId: s.sessionId,
      participantName: s.participantName,
      participantEmail: s.participantEmail,
      rankings: s.rankings,
      status: s.status,
      submittedAt: s.submittedAt?.toISOString(),
      createdAt: s.createdAt?.toISOString(),
    }))
  );
}
