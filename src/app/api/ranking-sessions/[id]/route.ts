import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";
import { UserModel } from "@/lib/models/User";
import { ClientModel } from "@/lib/models/Client";
import { hasPermission } from "@/lib/auth-helpers";

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

  // Must be owner or have permission to view others' sessions
  const isOwner = doc.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.rankingValues")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [submissionCount, creator, client] = await Promise.all([
    RankingSubmissionModel.countDocuments({ sessionId: id }),
    UserModel.findById(doc.createdBy).select("name image").lean(),
    ClientModel.findById(doc.clientId).select("company").lean(),
  ]);

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    clientName: client?.company ?? null,
    title: doc.title,
    description: doc.description,
    values: doc.values,
    status: doc.status,
    shareCode: doc.shareCode,
    createdBy: doc.createdBy,
    createdByName: creator?.name ?? "Unknown",
    createdByImage: creator?.image ?? null,
    submissionCount,
    createdAt: doc.createdAt?.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const existing = await RankingSessionModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check ownership or editAny permission
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.ranking.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.title !== undefined) update.title = body.title.trim();
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.status !== undefined) update.status = body.status;

  const doc = await RankingSessionModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    values: doc.values,
    status: doc.status,
    shareCode: doc.shareCode,
    createdAt: doc.createdAt?.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const existing = await RankingSessionModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check ownership or deleteAny permission
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.ranking.deleteAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await RankingSessionModel.findByIdAndDelete(id);

  // Clean up submissions
  await RankingSubmissionModel.deleteMany({ sessionId: id });

  return NextResponse.json({ success: true });
}
