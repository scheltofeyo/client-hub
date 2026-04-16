import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";
import { ClientModel } from "@/lib/models/Client";
import { UserModel } from "@/lib/models/User";
import { generateShareCode } from "@/lib/ranking/shareCode";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  await connectDB();

  // Show all sessions if user can view others', otherwise only own
  const filter = hasPermission(session, "tools.rankingValues")
    ? {}
    : { createdBy: session!.user.id };

  const sessions = await RankingSessionModel.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  // Batch-fetch submission counts
  const sessionIds = sessions.map((s) => s._id.toString());
  const counts = await RankingSubmissionModel.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: "$sessionId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.count]));

  // Batch-fetch client names
  const clientIds = [...new Set(sessions.map((s) => s.clientId))];
  const clients = await ClientModel.find({ _id: { $in: clientIds } })
    .select("company")
    .lean();
  const clientMap = new Map(clients.map((c) => [c._id.toString(), c.company]));

  // Batch-fetch creator names
  const creatorIds = [...new Set(sessions.map((s) => s.createdBy))];
  const creators = await UserModel.find({ _id: { $in: creatorIds } })
    .select("name image")
    .lean();
  const creatorMap = new Map(creators.map((u) => [u._id.toString(), { name: u.name, image: u.image }]));

  return NextResponse.json(
    sessions.map((s) => ({
      id: s._id.toString(),
      clientId: s.clientId,
      clientName: clientMap.get(s.clientId) ?? "Unknown",
      title: s.title,
      description: s.description,
      status: s.status,
      shareCode: s.shareCode,
      submissionCount: countMap.get(s._id.toString()) ?? 0,
      createdBy: s.createdBy,
      createdByName: creatorMap.get(s.createdBy)?.name ?? "Unknown",
      createdByImage: creatorMap.get(s.createdBy)?.image ?? null,
      createdAt: s.createdAt?.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  await connectDB();

  const body = await req.json();
  const { clientId, title, description, showBehaviors } = body;

  if (!clientId || !title?.trim()) {
    return NextResponse.json({ error: "Client and title are required" }, { status: 400 });
  }

  // Fetch client's cultural DNA
  const client = await ClientModel.findById(clientId).lean();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const dna = client.culturalDna ?? [];
  if (dna.length < 2) {
    return NextResponse.json(
      { error: "Client must have at least 2 cultural DNA values" },
      { status: 400 }
    );
  }

  // Generate unique share code
  let shareCode = generateShareCode();
  let attempts = 0;
  while (await RankingSessionModel.exists({ shareCode })) {
    shareCode = generateShareCode();
    attempts++;
    if (attempts > 10) {
      return NextResponse.json({ error: "Could not generate unique share code" }, { status: 500 });
    }
  }

  const doc = await RankingSessionModel.create({
    clientId,
    title: title.trim(),
    description: description?.trim() || undefined,
    values: dna.map((v) => ({
      id: v.id,
      title: v.title,
      color: v.color,
      mantra: v.mantra,
      description: v.description,
      behaviors: v.behaviors ?? [],
    })),
    culturalLevels: client.culturalLevels ?? [],
    showBehaviors: !!showBehaviors,
    status: "draft",
    shareCode,
    createdBy: session!.user.id,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      clientId: doc.clientId,
      title: doc.title,
      description: doc.description,
      values: doc.values,
      status: doc.status,
      shareCode: doc.shareCode,
      createdAt: doc.createdAt?.toISOString(),
    },
    { status: 201 }
  );
}
