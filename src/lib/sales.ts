/**
 * Shared sales-funnel logic — serializers and card moves — used by
 * src/lib/data.ts (server render), the /api/sales routes and the MCP tools, so
 * the surfaces can never drift apart.
 */
import type { Session } from "next-auth";
import type { ISalesBoard } from "./models/SalesBoard";
import type { ISalesCard } from "./models/SalesCard";
import type { SalesBoard, SalesCard } from "@/types";
import { connectDB } from "./mongodb";
import { SalesBoardModel } from "./models/SalesBoard";
import { SalesCardModel } from "./models/SalesCard";
import { recordActivity } from "./activity";

/** The lean() shape of a doc — same fields, no Document methods. */
type Lean<T> = Omit<T, keyof import("mongoose").Document> & {
  _id: import("mongoose").Types.ObjectId;
};

export function serializeSalesBoard(doc: Lean<ISalesBoard>): SalesBoard {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? undefined,
    rank: doc.rank ?? 0,
    columns: (doc.columns ?? [])
      .map((c) => ({ id: c.id, title: c.title, color: c.color, rank: c.rank ?? 0 }))
      .sort((a, b) => a.rank - b.rank),
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdVia: doc.createdVia ?? undefined,
    createdAt: doc.createdAt?.toISOString(),
  };
}

/**
 * Everything on a card that is actually stored. The joined client fields
 * (company, colour, contact) are added by getSalesCards; API responses fill
 * `company` from the caller's own client lookup or leave it empty, since the
 * board UI already holds the client data.
 */
export function serializeSalesCard(
  doc: Lean<ISalesCard>,
  joined?: Partial<Pick<SalesCard, "company" | "clientPrimaryColor" | "clientWebsite" | "contact">>
): SalesCard {
  return {
    id: doc._id.toString(),
    boardId: doc.boardId,
    columnId: doc.columnId,
    clientId: doc.clientId,
    order: doc.order ?? 0,
    owners: (doc.owners ?? []).map((o) => ({
      userId: o.userId,
      name: o.name,
      image: o.image ?? undefined,
    })),
    contactId: doc.contactId ?? undefined,
    source: doc.source ?? undefined,
    dealValue: doc.dealValue ?? undefined,
    expectedCloseDate: doc.expectedCloseDate ?? undefined,
    labels: doc.labels ?? [],
    notes: doc.notes ?? undefined,
    outcome: doc.outcome ?? undefined,
    outcomeAt: doc.outcomeAt ?? undefined,
    outcomeById: doc.outcomeById ?? undefined,
    outcomeByName: doc.outcomeByName ?? undefined,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdVia: doc.createdVia ?? undefined,
    createdAt: doc.createdAt?.toISOString(),
    company: joined?.company ?? "",
    clientPrimaryColor: joined?.clientPrimaryColor,
    clientWebsite: joined?.clientWebsite,
    contact: joined?.contact,
  };
}

// ── Card moves ───────────────────────────────────────────────────────

export type MoveSalesCardResult = { ok: true; from?: string; to: string } | { ok: false; error: string };

/**
 * Move a card to another column (or reorder it inside one).
 *
 * Two callers with deliberately different contracts. The board UI knows the
 * exact final order of the destination column after a drag, so it passes
 * `orderedIds` and this function just applies it. A model has no such list —
 * it knows "put Acme in Onderhandeling" — so it passes nothing and the
 * ordering is derived here.
 *
 * `toColumn` accepts a column id or its title for the same reason: a model
 * reasoning about the funnel has the stage name, not a UUID.
 */
export async function moveSalesCard(
  session: Session,
  boardId: string,
  cardId: string,
  toColumn: string,
  opts: { orderedIds?: string[]; position?: number } = {}
): Promise<MoveSalesCardResult> {
  await connectDB();

  const [board, card] = await Promise.all([
    SalesBoardModel.findById(boardId).lean(),
    SalesCardModel.findOne({ _id: cardId, boardId }).lean(),
  ]);
  if (!board) return { ok: false, error: `No board found with id ${boardId}.` };
  if (!card) return { ok: false, error: `No card found with id ${cardId} on board "${board.name}".` };

  const columns = board.columns ?? [];
  const target =
    columns.find((c) => c.id === toColumn) ??
    columns.find((c) => c.title.toLowerCase() === toColumn.trim().toLowerCase());
  if (!target) {
    const available = columns.map((c) => c.title).join(", ");
    return {
      ok: false,
      error: `"${toColumn}" is not a column on board "${board.name}". Available columns: ${available}.`,
    };
  }

  let orderedIds = opts.orderedIds;
  if (!orderedIds) {
    // Derive the destination order: the column's open cards as they stand,
    // minus this card (a same-column move is a reorder), with it reinserted.
    const existing = await SalesCardModel.find(
      { boardId, columnId: target.id, outcome: { $exists: false } },
      { _id: 1 }
    )
      .sort({ order: 1, createdAt: 1 })
      .lean();

    const ids = existing.map((c) => c._id.toString()).filter((id) => id !== cardId);
    const at =
      typeof opts.position === "number" && opts.position >= 0
        ? Math.min(Math.floor(opts.position), ids.length)
        : ids.length;
    ids.splice(at, 0, cardId);
    orderedIds = ids;
  }

  // Scoping every write to boardId stops ids from another board being hijacked.
  await Promise.all(
    orderedIds.map((id, index) =>
      SalesCardModel.findOneAndUpdate(
        { _id: id, boardId },
        { $set: { columnId: target.id, order: index } }
      )
    )
  );

  const fromColumn = columns.find((c) => c.id === card.columnId);
  if (card.columnId !== target.id) {
    await recordActivity({
      clientId: card.clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "sales.card_moved",
      metadata: {
        boardId,
        boardName: board.name,
        from: fromColumn?.title,
        to: target.title,
      },
    });
  }

  return { ok: true, from: fromColumn?.title, to: target.title };
}
