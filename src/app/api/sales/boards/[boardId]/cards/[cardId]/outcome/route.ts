import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { ClientModel } from "@/lib/models/Client";
import { recordActivity } from "@/lib/activity";

/** Seeded slugs a closed prospect lands on — see DEFAULT_CLIENT_STATUSES. */
const CLIENT_STATUS_ACTIVE = "active";
const CLIENT_STATUS_INACTIVE = "inactive";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; cardId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.convert");
  if (forbidden) return forbidden;

  const { boardId, cardId } = await params;
  const { outcome } = await req.json();

  if (outcome !== "won" && outcome !== "lost") {
    return NextResponse.json({ error: "outcome must be 'won' or 'lost'" }, { status: 400 });
  }

  await connectDB();
  const card = await SalesCardModel.findOne({ _id: cardId, boardId }).lean();
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (card.outcome) {
    return NextResponse.json({ error: "This card is already closed" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await SalesCardModel.findByIdAndUpdate(cardId, {
    $set: {
      outcome,
      outcomeAt: now,
      outcomeById: session!.user.id,
      outcomeByName: session!.user.name ?? "Unknown",
    },
  });

  // Closing a card resolves the prospect either way: won promotes it to an
  // active client, lost parks it as inactive. A client that is no longer a
  // prospect (already converted elsewhere) is left alone.
  let promoted = false;
  let demoted = false;
  const client = await ClientModel.findById(card.clientId).select("status clientSince").lean();
  if (client && client.status === "prospect") {
    if (outcome === "won") {
      const clientUpdate: Record<string, unknown> = { status: CLIENT_STATUS_ACTIVE };
      if (!client.clientSince) clientUpdate.clientSince = now.split("T")[0];
      await ClientModel.findByIdAndUpdate(card.clientId, { $set: clientUpdate });
      promoted = true;
    } else {
      await ClientModel.findByIdAndUpdate(card.clientId, { $set: { status: CLIENT_STATUS_INACTIVE } });
      demoted = true;
    }
  }

  const board = await SalesBoardModel.findById(boardId).select("name").lean();
  await recordActivity({
    clientId: card.clientId,
    actorId: session!.user.id,
    actorName: session!.user.name ?? "Unknown",
    type: outcome === "won" ? "sales.card_won" : "sales.card_lost",
    metadata: {
      boardId,
      boardName: board?.name,
      dealValue: card.dealValue,
      promoted,
      demoted,
    },
  });

  return NextResponse.json({ success: true, promoted, demoted });
}
