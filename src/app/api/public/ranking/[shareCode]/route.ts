import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";

/** Public: get session by share code (values + status, no participant data). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const doc = await RankingSessionModel.findOne({ shareCode }).lean();
  if (!doc) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const showBehaviors = !!doc.showBehaviors;

  return NextResponse.json({
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    values: showBehaviors
      ? doc.values
      : doc.values.map((v) => ({ id: v.id, title: v.title, color: v.color, mantra: v.mantra, description: v.description })),
    status: doc.status,
    ...(showBehaviors ? { culturalLevels: doc.culturalLevels ?? [], showBehaviors: true } : {}),
  });
}
