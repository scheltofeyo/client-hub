import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { ClientModel } from "@/lib/models/Client";
import { recordActivity } from "@/lib/activity";

/** The seeded slug a converted prospect lands on — see DEFAULT_CLIENT_STATUSES. */
const CLIENT_STATUS_ACTIVE = "active";

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

  // Won promotes the prospect to a client; lost leaves the client untouched.
  let promoted = false;
  if (outcome === "won") {
    const client = await ClientModel.findById(card.clientId).select("status clientSince").lean();
    if (client && client.status === "prospect") {
      const clientUpdate: Record<string, unknown> = { status: CLIENT_STATUS_ACTIVE };
      if (!client.clientSince) clientUpdate.clientSince = now.split("T")[0];
      await ClientModel.findByIdAndUpdate(card.clientId, { $set: clientUpdate });
      promoted = true;
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
    },
  });

  return NextResponse.json({ success: true, promoted });
}
