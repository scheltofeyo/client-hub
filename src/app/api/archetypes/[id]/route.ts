import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ArchetypeModel } from "@/lib/models/Archetype";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.archetypes");
  if (forbidden) return forbidden;

  const { id } = await params;
  const { name, color, description } = await req.json();

  const update: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    update.name = name.trim();
  }
  if (color !== undefined) {
    update.color = typeof color === "string" && color.trim() ? color.trim() : "#7C3AED";
  }
  if (description !== undefined) {
    const trimmed = typeof description === "string" ? description.trim() : "";
    update.description = trimmed || null;
  }

  await connectDB();
  const doc = await ArchetypeModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    rank: doc.rank ?? 0,
    color: doc.color ?? "#7C3AED",
    description: doc.description ?? undefined,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.archetypes");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ArchetypeModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
