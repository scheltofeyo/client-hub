/**
 * Shared serializers for the sales funnel, used by both src/lib/data.ts (server
 * render) and the /api/sales routes so the two can never drift apart.
 */
import type { ISalesBoard } from "./models/SalesBoard";
import type { ISalesCard } from "./models/SalesCard";
import type { SalesBoard, SalesCard } from "@/types";

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
    createdAt: doc.createdAt?.toISOString(),
    company: joined?.company ?? "",
    clientPrimaryColor: joined?.clientPrimaryColor,
    clientWebsite: joined?.clientWebsite,
    contact: joined?.contact,
  };
}
