import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { serializeSalesBoard } from "@/lib/sales";

type IncomingColumn = { id?: string; title?: string; color?: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.access");
  if (forbidden) return forbidden;

  const { boardId } = await params;
  await connectDB();
  const doc = await SalesBoardModel.findById(boardId).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serializeSalesBoard(doc));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.boards.manage");
  if (forbidden) return forbidden;

  const { boardId } = await params;
  const body = await req.json();

  await connectDB();
  const existing = await SalesBoardModel.findById(boardId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  if (body.description !== undefined) update.description = body.description?.trim() || null;

  if (body.columns !== undefined) {
    if (!Array.isArray(body.columns) || body.columns.length === 0) {
      return NextResponse.json({ error: "A board needs at least one column" }, { status: 400 });
    }
    const columns = (body.columns as IncomingColumn[]).map((c, index) => ({
      // A column without an id is new; existing ids must survive so cards keep pointing at them.
      id: c.id || randomUUID(),
      title: (c.title ?? "").trim() || "Naamloos",
      color: c.color || "#94A3B8",
      rank: index,
    }));

    // Cards in a removed column would become unreachable — reject rather than orphan them.
    const keptIds = new Set(columns.map((c) => c.id));
    const removedIds = (existing.columns ?? []).map((c) => c.id).filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      const stranded = await SalesCardModel.countDocuments({
        boardId,
        columnId: { $in: removedIds },
        outcome: { $exists: false },
      });
      if (stranded > 0) {
        return NextResponse.json(
          { error: "Move the cards out of a column before deleting it" },
          { status: 400 }
        );
      }
    }
    update.columns = columns;
  }

  const doc = await SalesBoardModel.findByIdAndUpdate(
    boardId,
    { $set: update },
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serializeSalesBoard(doc));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.boards.manage");
  if (forbidden) return forbidden;

  const { boardId } = await params;
  await connectDB();
  const existing = await SalesBoardModel.findById(boardId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade: cards belong to the board and have no meaning without it.
  await SalesCardModel.deleteMany({ boardId });
  await SalesBoardModel.findByIdAndDelete(boardId);

  return NextResponse.json({ success: true });
}
