import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { hasPermission, requirePermission } from "@/lib/auth-helpers";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { sendRankingResults } from "@/lib/ranking-email";

export async function POST(
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

  const isOwner = doc.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.ranking.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (doc.status !== "closed") {
    return NextResponse.json(
      { error: "Session must be closed to send results" },
      { status: 400 }
    );
  }

  const result = await sendRankingResults(id, {
    senderLabel: session?.user?.name ?? undefined,
  });

  return NextResponse.json(result);
}
