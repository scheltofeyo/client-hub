import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosModel } from "@/lib/models/Kudos";
import { KudosCategoryModel } from "@/lib/models/KudosCategory";
import { UserModel } from "@/lib/models/User";

function serializeKudos(doc: {
  _id: { toString: () => string };
  fromUserId: string;
  fromUserName: string;
  fromUserImage?: string;
  toUserIds: string[];
  toUsers?: { userId: string; name: string; image?: string }[];
  message: string;
  categoryId?: string;
  categorySnapshot?: { slug: string; label: string; color: string; icon: string };
  reactions?: { userId: string; emoji: string; createdAt: Date }[];
  createdAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    fromUserId: doc.fromUserId,
    fromUserName: doc.fromUserName,
    fromUserImage: doc.fromUserImage ?? undefined,
    toUserIds: doc.toUserIds,
    toUsers: (doc.toUsers ?? []).map((u) => ({
      userId: u.userId,
      name: u.name,
      image: u.image ?? undefined,
    })),
    message: doc.message,
    categoryId: doc.categoryId ?? undefined,
    categorySnapshot: doc.categorySnapshot ?? undefined,
    reactions: (doc.reactions ?? []).map((r) => ({
      userId: r.userId,
      emoji: r.emoji,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    createdAt: doc.createdAt?.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10) || 30, 100);
  const before = searchParams.get("before");
  const forMe = searchParams.get("forMe") === "true";

  await connectDB();

  const query: Record<string, unknown> = {};
  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
  }
  if (forMe && session?.user?.id) {
    query.toUserIds = session.user.id;
  }

  const docs = await KudosModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  return NextResponse.json(docs.map(serializeKudos));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const toUserIds: string[] = Array.isArray(body.toUserIds) ? body.toUserIds : [];
  const message: string = typeof body.message === "string" ? body.message.trim() : "";
  const categoryId: string | undefined = body.categoryId || undefined;

  if (toUserIds.length === 0) {
    return NextResponse.json({ error: "Kies minstens één collega" }, { status: 400 });
  }
  if (toUserIds.includes(session.user.id)) {
    return NextResponse.json({ error: "Je kunt jezelf geen kudo geven" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Bericht is verplicht" }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ error: "Bericht mag maximaal 500 tekens zijn" }, { status: 400 });
  }

  await connectDB();

  const recipients = await UserModel.find({ _id: { $in: toUserIds } })
    .select("_id name image")
    .lean();

  if (recipients.length !== toUserIds.length) {
    return NextResponse.json({ error: "Onbekende ontvanger(s)" }, { status: 400 });
  }

  let categorySnapshot: { slug: string; label: string; color: string; icon: string } | undefined;
  if (categoryId) {
    const cat = await KudosCategoryModel.findById(categoryId).lean();
    if (!cat) return NextResponse.json({ error: "Onbekende categorie" }, { status: 400 });
    categorySnapshot = { slug: cat.slug, label: cat.label, color: cat.color, icon: cat.icon };
  }

  const sender = await UserModel.findById(session.user.id).select("name image").lean();

  const doc = await KudosModel.create({
    fromUserId: session.user.id,
    fromUserName: sender?.name ?? session.user.name ?? "Onbekend",
    fromUserImage: sender?.image ?? session.user.image ?? undefined,
    toUserIds,
    toUsers: recipients.map((u) => ({
      userId: u._id.toString(),
      name: u.name,
      image: u.image ?? undefined,
    })),
    message,
    categoryId: categoryId || undefined,
    categorySnapshot,
    reactions: [],
  });

  return NextResponse.json(serializeKudos(doc.toObject()), { status: 201 });
}
