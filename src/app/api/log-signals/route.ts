import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { LogSignalModel } from "@/lib/models/LogSignal";

export async function GET() {
  await connectDB();
  const docs = await LogSignalModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  return NextResponse.json(
    docs.map((d) => ({ id: d._id.toString(), name: d.name, rank: d.rank ?? 0 }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await connectDB();
  const last = await LogSignalModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;
  const doc = await LogSignalModel.create({ name: name.trim(), rank });
  return NextResponse.json(
    { id: doc._id.toString(), name: doc.name, rank: doc.rank },
    { status: 201 }
  );
}
