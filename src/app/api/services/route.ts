import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ServiceModel } from "@/lib/models/Service";

export async function GET() {
  await connectDB();
  const docs = await ServiceModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  return NextResponse.json(
    docs.map((d) => ({ id: d._id.toString(), name: d.name, rank: d.rank ?? 0, checkInDays: d.checkInDays ?? null }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, checkInDays } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const parsedDays = checkInDays != null && checkInDays !== "" ? Number(checkInDays) : null;

  await connectDB();
  const last = await ServiceModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;
  const doc = await ServiceModel.create({ name: name.trim(), rank, checkInDays: parsedDays });
  return NextResponse.json(
    { id: doc._id.toString(), name: doc.name, rank: doc.rank, checkInDays: doc.checkInDays ?? null },
    { status: 201 }
  );
}
