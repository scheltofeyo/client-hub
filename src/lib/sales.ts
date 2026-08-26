/**
 * Shared sales-funnel logic — serializers, card writes and card moves — used by
 * src/lib/data.ts (server render), the /api/sales routes and the MCP tools, so
 * the surfaces can never drift apart.
 */
import mongoose from "mongoose";
import type { Session } from "next-auth";
import type { ISalesBoard, ISalesBoardColumn } from "./models/SalesBoard";
import type { ISalesCard } from "./models/SalesCard";
import type { IClient } from "./models/Client";
import type { SalesBoard, SalesCard } from "@/types";
import { connectDB } from "./mongodb";
import { SalesBoardModel } from "./models/SalesBoard";
import { SalesCardModel } from "./models/SalesCard";
import { ClientModel } from "./models/Client";
import { creatorFields } from "./actor";
import { recordActivity } from "./activity";
import { fmtDate } from "./utils";

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

// ── Columns ──────────────────────────────────────────────────────────

/** A board's columns in the order the board itself shows them. */
function columnsByRank(board: Lean<ISalesBoard>): ISalesBoardColumn[] {
  return [...(board.columns ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}

/**
 * Find a column by its id or by its title, case-insensitively.
 *
 * The title fallback is what lets a model work in the words the board uses: it
 * reasons about "Onderhandeling", not about a UUID. A miss comes back naming
 * the columns that do exist, since a caller that guessed once will otherwise
 * guess again.
 */
function resolveColumn(
  board: Lean<ISalesBoard>,
  ref: string
): { ok: true; column: ISalesBoardColumn } | { ok: false; error: string } {
  const columns = columnsByRank(board);
  const column =
    columns.find((c) => c.id === ref) ??
    columns.find((c) => c.title.toLowerCase() === ref.trim().toLowerCase());
  if (column) return { ok: true, column };

  const available = columns.map((c) => c.title).join(", ");
  return {
    ok: false,
    error: `"${ref}" is not a column on board "${board.name}". Available columns: ${available}.`,
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

  const resolved = resolveColumn(board, toColumn);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const target = resolved.column;

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

  const fromColumn = (board.columns ?? []).find((c) => c.id === card.columnId);
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

// ── Card creation ────────────────────────────────────────────────────

export type CreateSalesCardInput = {
  clientId: string;
  /** Column id or title. Defaults to the board's first stage. */
  column?: string;
};

/**
 * A refusal carries the status the REST route should answer with rather than
 * being collapsed into one 400 the way /cards/move was: this route already
 * promised a 404 for a missing board or client, and the extraction is not the
 * place to take that back. The MCP tool ignores the status and reads only the
 * message.
 */
export type CreateSalesCardResult =
  | {
      ok: true;
      card: Lean<ISalesCard>;
      board: Lean<ISalesBoard>;
      client: Lean<IClient>;
      column: ISalesBoardColumn;
    }
  | { ok: false; error: string; status: 400 | 404 };

/** What both callers need back about the client: the joined card fields. */
const CARD_CLIENT_SELECT = "company status primaryColor website contacts";

/**
 * Put a prospect on a board, at the end of a column.
 *
 * Everything that can refuse does so before the document is written, so a
 * refusal can never leave a card behind — the same guarantee createClient()
 * and createTask() give.
 *
 * Note what this deliberately does *not* check: whether the client already has
 * a card on this board. See findOpenCardForClient below.
 */
export async function createSalesCard(
  session: Session,
  boardId: string,
  input: CreateSalesCardInput
): Promise<CreateSalesCardResult> {
  const { clientId } = input;
  await connectDB();

  // An id that is not an ObjectId at all would make findById throw, so it is
  // answered as the "not found" it means.
  const [board, client] = await Promise.all([
    mongoose.Types.ObjectId.isValid(boardId) ? SalesBoardModel.findById(boardId).lean() : null,
    mongoose.Types.ObjectId.isValid(clientId)
      ? ClientModel.findById(clientId).select(CARD_CLIENT_SELECT).lean()
      : null,
  ]);
  if (!board) return { ok: false, status: 404, error: `No board found with id ${boardId}.` };
  if (!client) return { ok: false, status: 404, error: `No client found with id ${clientId}.` };

  // A board is a funnel of prospects: an active client on one would sit outside
  // every stage its columns describe.
  if (client.status !== "prospect") {
    return {
      ok: false,
      status: 400,
      error:
        `"${client.company}" has status "${client.status ?? "none"}", not "prospect" — only ` +
        `prospects can be put on a sales board.`,
    };
  }

  let column: ISalesBoardColumn | undefined;
  if (input.column) {
    const resolved = resolveColumn(board, input.column);
    if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
    column = resolved.column;
  } else {
    // Default to the first stage, so a caller can hand over just a clientId.
    column = columnsByRank(board)[0];
  }
  if (!column) {
    return {
      ok: false,
      status: 400,
      error: `Board "${board.name}" has no columns to put a card in.`,
    };
  }

  const last = await SalesCardModel.findOne({ boardId, columnId: column.id })
    .sort({ order: -1 })
    .lean();

  const doc = await SalesCardModel.create({
    boardId,
    columnId: column.id,
    clientId,
    order: last ? (last.order ?? 0) + 1 : 0,
    owners: [],
    labels: [],
    ...(await creatorFields(session)),
  });

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "sales.card_added",
    metadata: { boardId, boardName: board.name, columnTitle: column.title },
  });

  return {
    ok: true,
    card: doc.toObject() as Lean<ISalesCard>,
    board,
    client,
    column,
  };
}

/**
 * The client's open (not yet won or lost) card on this board, if it has one.
 *
 * Deliberately not called by createSalesCard or by the REST route — the same
 * shape, and the same reasoning, as findDuplicateClients() in ./clients.
 * SalesBoardView hands AddProspectPicker the board's open cards and the picker
 * greys out a prospect already on it, so there is nothing here for the check to
 * catch and leaving POST untouched keeps its behaviour exactly as it was. A
 * model that has not read the board first has no such protection, so the MCP
 * tool checks before it writes.
 */
export async function findOpenCardForClient(
  boardId: string,
  clientId: string
): Promise<{ cardId: string; columnId: string } | null> {
  await connectDB();
  const card = await SalesCardModel.findOne({
    boardId,
    clientId,
    outcome: { $exists: false },
  })
    .select("columnId")
    .lean();

  return card ? { cardId: card._id.toString(), columnId: card.columnId } : null;
}

// ── Card edits ───────────────────────────────────────────────────────

export type UpdateSalesCardInput = {
  owners?: unknown;
  contactId?: unknown;
  source?: unknown;
  dealValue?: unknown;
  expectedCloseDate?: unknown;
  labels?: unknown;
  notes?: unknown;
  /** Add to `notes` instead of replacing it. Mutually exclusive with `notes`. */
  appendNote?: unknown;
};

export type UpdateSalesCardResult =
  | { ok: true; card: Lean<ISalesCard>; changed: string[] }
  | { ok: false; error: string; status: 400 | 404 };

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Prepend a dated, attributed entry to a card's notes.
 *
 * `notes` is one text field, not a collection, so the only way to "write a
 * note" without losing the last one is to fold it into the same string. Newest
 * first because the card shows the field in a fixed-height box — the entry
 * someone just added should be the one visible without scrolling.
 */
function prependNote(existing: string | undefined, note: string, author: string): string {
  const stamp = fmtDate(new Date().toISOString().split("T")[0]);
  const entry = `${stamp} — ${author}\n${note}`;
  const before = (existing ?? "").trim();
  return before ? `${entry}\n\n${before}` : entry;
}

/**
 * Update one card's own fields — everything except which column it sits in,
 * which is moveSalesCard()'s job.
 *
 * Owners arrive already resolved to `{ userId, name, image }`: the board UI
 * picks real people out of a list, and the MCP tool resolves names to users
 * before calling. The snapshot has to carry `image`, since the board reads
 * `owners[].image` rather than joining against User.
 */
export async function updateSalesCard(
  session: Session,
  boardId: string,
  cardId: string,
  input: UpdateSalesCardInput
): Promise<UpdateSalesCardResult> {
  await connectDB();

  const existing = await SalesCardModel.findOne({ _id: cardId, boardId }).lean();
  if (!existing) return { ok: false, error: "Not found", status: 404 };

  if (input.notes !== undefined && input.appendNote !== undefined) {
    return {
      ok: false,
      error:
        "Pass either notes or appendNote, not both — appendNote adds to what is already " +
        "there, notes replaces all of it.",
      status: 400,
    };
  }

  const update: Record<string, unknown> = {};
  if (input.owners !== undefined) {
    update.owners = (input.owners as { userId: string; name: string; image?: string }[]).map(
      (o) => ({ userId: o.userId, name: o.name, image: o.image })
    );
  }
  if (input.contactId !== undefined) update.contactId = input.contactId || null;
  if (input.source !== undefined) update.source = trimmed(input.source) || null;
  if (input.dealValue !== undefined) {
    const n =
      input.dealValue === null || input.dealValue === "" ? null : Number(input.dealValue);
    if (n !== null && (Number.isNaN(n) || n < 0)) {
      return { ok: false, error: "dealValue must be a positive number", status: 400 };
    }
    update.dealValue = n;
  }
  if (input.expectedCloseDate !== undefined) {
    update.expectedCloseDate = input.expectedCloseDate || null;
  }
  if (input.labels !== undefined) {
    update.labels = (input.labels as string[]).map((l) => l.trim()).filter(Boolean);
  }
  if (input.notes !== undefined) update.notes = input.notes || null;
  if (input.appendNote !== undefined) {
    const note = trimmed(input.appendNote);
    if (!note) return { ok: false, error: "appendNote cannot be empty", status: 400 };
    update.notes = prependNote(existing.notes, note, session.user.name ?? "Unknown");
  }

  const doc = await SalesCardModel.findByIdAndUpdate(cardId, { $set: update }, { new: true }).lean();
  if (!doc) return { ok: false, error: "Not found", status: 404 };

  // appendNote reports as "notes" — the activity log records which field moved,
  // not which argument spelling got it there.
  const changed = (
    ["owners", "dealValue", "expectedCloseDate", "source", "labels", "notes", "contactId"] as const
  ).filter((f) => input[f] !== undefined || (f === "notes" && input.appendNote !== undefined));

  if (changed.length > 0) {
    const board = await SalesBoardModel.findById(boardId).select("name").lean();
    await recordActivity({
      clientId: doc.clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "sales.card_updated",
      metadata: { boardId, boardName: board?.name, fields: changed },
    });
  }

  return { ok: true, card: doc as Lean<ISalesCard>, changed: [...changed] };
}
