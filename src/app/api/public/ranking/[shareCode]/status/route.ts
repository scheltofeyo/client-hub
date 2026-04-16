import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";

/** Public: poll endpoint — returns session status. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const doc = await RankingSessionModel.findOne({ shareCode }).select("status").lean();
  if (!doc) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json({ status: doc.status });
}
