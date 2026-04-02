import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { EventTypeModel, DEFAULT_EVENT_TYPES } from "@/lib/models/EventType";

export async function GET() {
  await connectDB();

  // Upsert any missing defaults (preserves existing customised entries)
  await Promise.all(
    DEFAULT_EVENT_TYPES.map((et, i) =>
      EventTypeModel.updateOne(
        { slug: et.slug },
        { $setOnInsert: { ...et, rank: i } },
        { upsert: true }
      )
    )
  );

  const docs = await EventTypeModel.find().sort({ rank: 1, createdAt: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: d._id.toString(),
      slug: d.slug,
      label: d.label,
      color: d.color,
      icon: d.icon,
      rank: d.rank ?? 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { label, color, icon } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  await connectDB();

  const existing = await EventTypeModel.findOne({ slug }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "An event type with this name already exists" },
      { status: 409 }
    );
  }

  const last = await EventTypeModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  const doc = await EventTypeModel.create({
    slug,
    label: label.trim(),
    color: color ?? "#6366f1",
    icon: icon ?? "Circle",
    rank,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      slug: doc.slug,
      label: doc.label,
      color: doc.color,
      icon: doc.icon,
      rank: doc.rank,
    },
    { status: 201 }
  );
}
