import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { ClientModel } from "@/lib/models/Client";
import { createSalesCard, serializeSalesCard } from "@/lib/sales";

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

  // The write itself lives in createSalesCard so the MCP tool cannot drift from
  // it — the prospect-only rule, the first-column fallback, the append and the
  // sales.card_added event are all there.
  const created = await createSalesCard(session!, boardId, { clientId, column: columnId });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  return NextResponse.json(
    serializeSalesCard(created.card, {
      company: created.client.company,
      clientPrimaryColor: created.client.primaryColor ?? undefined,
      clientWebsite: created.client.website ?? undefined,
    }),
    { status: 201 }
  );
}
