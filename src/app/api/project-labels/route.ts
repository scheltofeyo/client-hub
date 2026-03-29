import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ProjectLabelModel } from "@/lib/models/ProjectLabel";

const DEFAULT_LABELS = ["New Business", "Platform", "Next Business"];

export async function GET() {
  await connectDB();
  let docs = await ProjectLabelModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  if (docs.length === 0) {
    await Promise.all(
      DEFAULT_LABELS.map((name, i) => ProjectLabelModel.create({ name, rank: i }))
    );
    docs = await ProjectLabelModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  }
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
  const last = await ProjectLabelModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;
  const doc = await ProjectLabelModel.create({ name: name.trim(), rank });
  return NextResponse.json(
    { id: doc._id.toString(), name: doc.name, rank: doc.rank },
    { status: 201 }
  );
}
