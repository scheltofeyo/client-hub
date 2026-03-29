import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { EventTypeModel, SYSTEM_EVENT_TYPE_SLUGS } from "@/lib/models/EventType";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { label, color, icon } = await req.json();

  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  await connectDB();
  const existing = await EventTypeModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((SYSTEM_EVENT_TYPE_SLUGS as readonly string[]).includes(existing.slug)) {
    return NextResponse.json({ error: "System event types cannot be modified" }, { status: 403 });
  }

  const doc = await EventTypeModel.findByIdAndUpdate(
    id,
    { $set: { label: label.trim(), color, icon } },
    { new: true }
  ).lean();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    slug: doc.slug,
    label: doc.label,
    color: doc.color,
    icon: doc.icon,
    rank: doc.rank,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const doc = await EventTypeModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((SYSTEM_EVENT_TYPE_SLUGS as readonly string[]).includes(doc.slug)) {
    return NextResponse.json({ error: "System event types cannot be deleted" }, { status: 403 });
  }
  await EventTypeModel.findByIdAndDelete(id);

  return NextResponse.json({ success: true });
}
