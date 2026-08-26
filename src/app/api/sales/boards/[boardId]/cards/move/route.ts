import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { moveSalesCard } from "@/lib/sales";

/**
 * One endpoint for both reordering inside a column and moving between columns.
 * `orderedIds` is the full, final id list of the destination column — the board
 * UI knows it after a drag, so it is passed straight through to moveSalesCard.
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

  const result = await moveSalesCard(session!, boardId, cardId, toColumnId, { orderedIds });
  if (!result.ok) {
    // A missing board, card or column was a 404/400 before the extraction; the
    // helper reports them all as a message, and the UI only ever sends ids it
    // just rendered, so a single 400 is enough here.
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
