import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { ClientModel } from "@/lib/models/Client";
import { serializeSalesCard } from "@/lib/sales";
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

  await connectDB();
  const existing = await SalesCardModel.findOne({ _id: cardId, boardId }).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.owners !== undefined) {
    update.owners = (body.owners as { userId: string; name: string; image?: string }[]).map((o) => ({
      userId: o.userId,
      name: o.name,
      image: o.image,
    }));
  }
  if (body.contactId !== undefined) update.contactId = body.contactId || null;
  if (body.source !== undefined) update.source = body.source?.trim() || null;
  if (body.dealValue !== undefined) {
    const n = body.dealValue === null || body.dealValue === "" ? null : Number(body.dealValue);
    if (n !== null && (Number.isNaN(n) || n < 0)) {
      return NextResponse.json({ error: "dealValue must be a positive number" }, { status: 400 });
    }
    update.dealValue = n;
  }
  if (body.expectedCloseDate !== undefined) update.expectedCloseDate = body.expectedCloseDate || null;
  if (body.labels !== undefined) {
    update.labels = (body.labels as string[]).map((l) => l.trim()).filter(Boolean);
  }
  if (body.notes !== undefined) update.notes = body.notes || null;

  const doc = await SalesCardModel.findByIdAndUpdate(cardId, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trackFields = ["owners", "dealValue", "expectedCloseDate", "source", "labels", "notes", "contactId"] as const;
  const updatedFields = trackFields.filter((f) => body[f] !== undefined);
  if (updatedFields.length > 0) {
    const board = await SalesBoardModel.findById(boardId).select("name").lean();
    await recordActivity({
      clientId: doc.clientId,
      actorId: session!.user.id,
      actorName: session!.user.name ?? "Unknown",
      type: "sales.card_updated",
      metadata: { boardId, boardName: board?.name, fields: updatedFields },
    });
  }

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
