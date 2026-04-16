import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";
import { findBalancedPairs, findBestDuoForUnmatched, normalizeDistance } from "@/lib/ranking/matching";
import type { Submission } from "@/lib/ranking/matching";

/** Public: when session is closed, returns all submissions + computed match pairs. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const session = await RankingSessionModel.findOne({ shareCode }).lean();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status !== "closed" && session.status !== "archived") {
    return NextResponse.json({ error: "Results not available yet" }, { status: 400 });
  }

  const submissions = await RankingSubmissionModel.find({
    sessionId: session._id.toString(),
    status: "completed",
  })
    .sort({ submittedAt: 1 })
    .lean();

  const mapped: Submission[] = submissions.map((s) => ({
    id: s._id.toString(),
    participantName: s.participantName,
    participantEmail: s.participantEmail,
    rankings: s.rankings ?? [],
  }));

  const numValues = session.values.length;
  const { pairs, unmatched } = findBalancedPairs(mapped);

  const bestDuo = unmatched ? findBestDuoForUnmatched(unmatched, pairs, numValues) : null;

  return NextResponse.json({
    pairs: pairs.map((p) => ({
      participant1: { id: p.participant1.id, participantName: p.participant1.participantName },
      participant2: { id: p.participant2.id, participantName: p.participant2.participantName },
      opposition: normalizeDistance(p.distance, numValues),
    })),
    unmatched: unmatched ? { id: unmatched.id, participantName: unmatched.participantName } : null,
    bestDuo: bestDuo
      ? {
          pairParticipant1: bestDuo.pair.participant1.participantName,
          pairParticipant1Id: bestDuo.pair.participant1.id,
          pairParticipant2: bestDuo.pair.participant2.participantName,
          pairParticipant2Id: bestDuo.pair.participant2.id,
          avgOpposition: bestDuo.avgOpposition,
        }
      : null,
    submissions: mapped.map((s) => ({
      id: s.id,
      participantName: s.participantName,
      rankings: s.rankings,
    })),
    values: session.values,
  });
}
