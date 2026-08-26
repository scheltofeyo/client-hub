import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SalesBoardModel, DEFAULT_SALES_COLUMNS } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { serializeSalesBoard } from "@/lib/sales";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.access");
  if (forbidden) return forbidden;

  await connectDB();
  const [docs, totals] = await Promise.all([
    SalesBoardModel.find().sort({ rank: 1, createdAt: 1 }).lean(),
    SalesCardModel.aggregate<{ _id: string; count: number; value: number }>([
      { $match: { outcome: { $exists: false } } },
      { $group: { _id: "$boardId", count: { $sum: 1 }, value: { $sum: { $ifNull: ["$dealValue", 0] } } } },
    ]),
  ]);
  const totalsMap = new Map(totals.map((t) => [t._id, t]));

  return NextResponse.json(
    docs.map((doc) => {
      const board = serializeSalesBoard(doc);
      const t = totalsMap.get(board.id);
      return { ...board, cardCount: t?.count ?? 0, totalValue: t?.value ?? 0 };
    })
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "sales.boards.manage");
  if (forbidden) return forbidden;

  const { name, description } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await connectDB();
  const last = await SalesBoardModel.findOne().sort({ rank: -1 }).lean();

  const doc = await SalesBoardModel.create({
    name: name.trim(),
    description: description?.trim() || undefined,
    rank: last ? (last.rank ?? 0) + 1 : 0,
    columns: DEFAULT_SALES_COLUMNS.map((c, i) => ({ id: randomUUID(), ...c, rank: i })),
    createdById: session!.user.id,
    createdByName: session!.user.name ?? "Unknown",
  });

  return NextResponse.json(serializeSalesBoard(doc.toObject()), { status: 201 });
}
