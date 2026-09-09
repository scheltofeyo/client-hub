import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { resolveSessionMatching } from "@/lib/ranking/match-session";

/**
 * The facilitator's view of the matching.
 *
 * Deliberately thin: it resolves the pairing through the same
 * `resolveSessionMatching()` the participant results route uses, so what a
 * facilitator briefs from and what people see on their phones cannot drift
 * apart. The admin page used to compute this in the browser, which is exactly
 * how the two ended up disagreeing.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const doc = await RankingSessionModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same gate as the sibling submissions route.
  const isOwner = doc.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.rankingValues")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matching = await resolveSessionMatching(doc);

  return NextResponse.json({
    pairs: matching.pairs,
    unmatchedId: matching.unmatchedId,
    bestDuo: matching.bestDuo,
    participants: matching.participants,
    invalid: matching.invalid,
    frozen: matching.frozen,
  });
}
