import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { recordActivity } from "@/lib/activity";

/**
 * One endpoint for both reordering inside a column and moving between columns.
 * `orderedIds` is the full, final id list of the destination column.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.cards.manage");
  if (forbidden) return forbidden;

  const { boardId } = await params;
  const { cardId, toColumnId, orderedIds } = await req.json();

  if (!cardId || !toColumnId) {
    return NextResponse.json({ error: "cardId and toColumnId are required" }, { status: 400 });
  }
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 });
  }

  await connectDB();
  const [board, card] = await Promise.all([
    SalesBoardModel.findById(boardId).lean(),
    SalesCardModel.findOne({ _id: cardId, boardId }).lean(),
  ]);
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetColumn = (board.columns ?? []).find((c) => c.id === toColumnId);
  if (!targetColumn) {
    return NextResponse.json({ error: "Column not found on this board" }, { status: 400 });
  }

  // Scoping every write to boardId stops ids from another board being hijacked.
  await Promise.all(
    orderedIds.map((id: string, index: number) =>
      SalesCardModel.findOneAndUpdate(
        { _id: id, boardId },
        { $set: { columnId: toColumnId, order: index } }
      )
    )
  );

  if (card.columnId !== toColumnId) {
    const fromColumn = (board.columns ?? []).find((c) => c.id === card.columnId);
    await recordActivity({
      clientId: card.clientId,
      actorId: session!.user.id,
      actorName: session!.user.name ?? "Unknown",
      type: "sales.card_moved",
      metadata: {
        boardId,
        boardName: board.name,
        from: fromColumn?.title,
        to: targetColumn.title,
      },
    });
  }

  return NextResponse.json({ success: true });
}
