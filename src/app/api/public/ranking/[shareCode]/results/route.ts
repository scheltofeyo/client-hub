import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { resolveSessionMatching } from "@/lib/ranking/match-session";

/**
 * Public: when the session is closed, returns all submissions + the match pairs.
 *
 * The pairing comes from `resolveSessionMatching()`, the same call the admin
 * overview makes, so a participant and the facilitator can never be looking at
 * different duos.
 */
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

  const matching = await resolveSessionMatching(session);
  const nameOf = (id: string) =>
    matching.participants.find((p) => p.id === id)?.participantName ?? "";

  return NextResponse.json({
    pairs: matching.pairs.map((p) => ({
      participant1: { id: p.participant1Id, participantName: nameOf(p.participant1Id) },
      participant2: { id: p.participant2Id, participantName: nameOf(p.participant2Id) },
      opposition: p.opposition,
    })),
    unmatched: matching.unmatchedId
      ? { id: matching.unmatchedId, participantName: nameOf(matching.unmatchedId) }
      : null,
    bestDuo: matching.bestDuo
      ? {
          pairParticipant1: nameOf(matching.bestDuo.participant1Id),
          pairParticipant1Id: matching.bestDuo.participant1Id,
          pairParticipant2: nameOf(matching.bestDuo.participant2Id),
          pairParticipant2Id: matching.bestDuo.participant2Id,
          avgOpposition: matching.bestDuo.avgOpposition,
        }
      : null,
    submissions: matching.participants,
    values: session.values,
  });
}
