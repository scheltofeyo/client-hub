import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosCategoryModel, DEFAULT_KUDOS_CATEGORIES } from "@/lib/models/KudosCategory";

export async function GET() {
  await connectDB();

  await Promise.all(
    DEFAULT_KUDOS_CATEGORIES.map((c, i) =>
      KudosCategoryModel.updateOne(
        { slug: c.slug },
        { $setOnInsert: { ...c, rank: i } },
        { upsert: true }
      )
    )
  );

  const docs = await KudosCategoryModel.find().sort({ rank: 1, createdAt: 1 }).lean();

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
  const forbidden = requirePermission(session, "admin.kudosCategories");
  if (forbidden) return forbidden;

  const { label, color, icon } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await connectDB();

  const existing = await KudosCategoryModel.findOne({ slug }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }

  const last = await KudosCategoryModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  const doc = await KudosCategoryModel.create({
    slug,
    label: label.trim(),
    color: color ?? "#8b5cf6",
    icon: icon ?? "Sparkles",
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
