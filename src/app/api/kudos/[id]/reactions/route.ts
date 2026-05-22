import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosModel, KUDOS_REACTION_EMOJIS, type KudosReactionEmoji } from "@/lib/models/Kudos";

function isValidEmoji(e: unknown): e is KudosReactionEmoji {
  return typeof e === "string" && (KUDOS_REACTION_EMOJIS as readonly string[]).includes(e);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { emoji } = await req.json();
  if (!isValidEmoji(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  await connectDB();
  const doc = await KudosModel.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session.user.id;
  const existingIdx = doc.reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);

  if (existingIdx >= 0) {
    doc.reactions.splice(existingIdx, 1);
  } else {
    doc.reactions.push({ userId, emoji, createdAt: new Date() });
  }
  await doc.save();

  return NextResponse.json({
    reactions: doc.reactions.map((r) => ({
      userId: r.userId,
      emoji: r.emoji,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const emoji = searchParams.get("emoji");
  if (!isValidEmoji(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  await connectDB();
  await KudosModel.findByIdAndUpdate(id, {
    $pull: { reactions: { userId: session.user.id, emoji } },
  });

  return NextResponse.json({ success: true });
}
