import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { ClientModel } from "@/lib/models/Client";
import { serializeSalesCard, updateSalesCard } from "@/lib/sales";
import { recordActivity } from "@/lib/activity";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; cardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.cards.manage");
  if (forbidden) return forbidden;

  const { boardId, cardId } = await params;
  const body = await req.json();

  // Field handling, the dealValue check and the activity event all live in
  // updateSalesCard(), which the MCP tool calls too.
  const result = await updateSalesCard(session!, boardId, cardId, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const doc = result.card;
  const client = await ClientModel.findById(doc.clientId)
    .select("company primaryColor website contacts")
    .lean();

  return NextResponse.json(
    serializeSalesCard(doc, {
      company: client?.company ?? "Onbekende prospect",
      clientPrimaryColor: client?.primaryColor ?? undefined,
      clientWebsite: client?.website ?? undefined,
      contact: doc.contactId
        ? (client?.contacts ?? []).find((c) => c.id === doc.contactId)
        : undefined,
    })
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string; cardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.cards.manage");
  if (forbidden) return forbidden;

  const { boardId, cardId } = await params;
  await connectDB();
  const existing = await SalesCardModel.findOne({ _id: cardId, boardId }).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await SalesCardModel.findByIdAndDelete(cardId);

  const board = await SalesBoardModel.findById(boardId).select("name").lean();
  await recordActivity({
    clientId: existing.clientId,
    actorId: session!.user.id,
    actorName: session!.user.name ?? "Unknown",
    type: "sales.card_removed",
    metadata: { boardId, boardName: board?.name },
  });

  return NextResponse.json({ success: true });
}
