import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { creatorFields } from "@/lib/actor";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { ClientModel } from "@/lib/models/Client";
import { serializeSalesCard } from "@/lib/sales";
import { recordActivity } from "@/lib/activity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.access");
  if (forbidden) return forbidden;

  const { boardId } = await params;
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";

  await connectDB();
  const filter: Record<string, unknown> = { boardId };
  if (!includeArchived) filter.outcome = { $exists: false };
  const docs = await SalesCardModel.find(filter).sort({ order: 1, createdAt: 1 }).lean();

  const clientDocs = await ClientModel.find({ _id: { $in: docs.map((d) => d.clientId) } })
    .select("company primaryColor website contacts")
    .lean();
  const clientMap = new Map(clientDocs.map((c) => [c._id.toString(), c]));

  return NextResponse.json(
    docs.map((doc) => {
      const client = clientMap.get(doc.clientId);
      return serializeSalesCard(doc, {
        company: client?.company ?? "Onbekende prospect",
        clientPrimaryColor: client?.primaryColor ?? undefined,
        clientWebsite: client?.website ?? undefined,
        contact: doc.contactId
          ? (client?.contacts ?? []).find((c) => c.id === doc.contactId)
          : undefined,
      });
    })
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.cards.manage");
  if (forbidden) return forbidden;

  const { boardId } = await params;
  const { clientId, columnId } = await req.json();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  await connectDB();
  const [board, client] = await Promise.all([
    SalesBoardModel.findById(boardId).lean(),
    ClientModel.findById(clientId).select("company status primaryColor website contacts").lean(),
  ]);
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client.status !== "prospect") {
    return NextResponse.json({ error: "Only prospects can be added to a board" }, { status: 400 });
  }

  // Default to the first column so the caller can just hand over a clientId.
  const columns = [...(board.columns ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const targetColumn = columnId
    ? columns.find((c) => c.id === columnId)
    : columns[0];
  if (!targetColumn) {
    return NextResponse.json({ error: "Column not found on this board" }, { status: 400 });
  }

  const last = await SalesCardModel.findOne({ boardId, columnId: targetColumn.id })
    .sort({ order: -1 })
    .lean();

  const doc = await SalesCardModel.create({
    boardId,
    columnId: targetColumn.id,
    clientId,
    order: last ? (last.order ?? 0) + 1 : 0,
    owners: [],
    labels: [],
    ...(await creatorFields(session!)),
  });

  await recordActivity({
    clientId,
    actorId: session!.user.id,
    actorName: session!.user.name ?? "Unknown",
    type: "sales.card_added",
    metadata: { boardId, boardName: board.name, columnTitle: targetColumn.title },
  });

  return NextResponse.json(
    serializeSalesCard(doc.toObject(), {
      company: client.company,
      clientPrimaryColor: client.primaryColor ?? undefined,
      clientWebsite: client.website ?? undefined,
    }),
    { status: 201 }
  );
}
