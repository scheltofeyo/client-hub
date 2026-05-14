import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ArchetypeModel } from "@/lib/models/Archetype";

const DEFAULT_COLOR = "#7C3AED";

export async function GET() {
  await connectDB();
  const docs = await ArchetypeModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  return NextResponse.json(
    docs.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      rank: d.rank ?? 0,
      color: d.color ?? DEFAULT_COLOR,
      description: d.description ?? undefined,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.archetypes");
  if (forbidden) return forbidden;

  const { name, color, description } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await connectDB();
  const last = await ArchetypeModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;
  const doc = await ArchetypeModel.create({
    name: name.trim(),
    rank,
    color: typeof color === "string" && color.trim() ? color.trim() : DEFAULT_COLOR,
    description: typeof description === "string" && description.trim() ? description.trim() : undefined,
  });
  return NextResponse.json(
    {
      id: doc._id.toString(),
      name: doc.name,
      rank: doc.rank,
      color: doc.color,
      description: doc.description ?? undefined,
    },
    { status: 201 }
  );
}
