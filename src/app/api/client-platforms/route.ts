import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ClientPlatformOptionModel, DEFAULT_CLIENT_PLATFORMS } from "@/lib/models/ClientPlatformOption";

export async function GET() {
  await connectDB();
  let docs = await ClientPlatformOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();

  if (docs.length === 0) {
    await Promise.all(
      DEFAULT_CLIENT_PLATFORMS.map((p, i) =>
        ClientPlatformOptionModel.create({ ...p, rank: i })
      )
    );
    docs = await ClientPlatformOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  }

  return NextResponse.json(
    docs.map((d) => ({ id: d._id.toString(), slug: d.slug, label: d.label, rank: d.rank ?? 0 }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.clientPlatforms");
  if (forbidden) return forbidden;

  const { label } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const slug = label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!slug) {
    return NextResponse.json({ error: "Could not generate a valid slug from label" }, { status: 400 });
  }

  await connectDB();
  const last = await ClientPlatformOptionModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  try {
    const doc = await ClientPlatformOptionModel.create({ slug, label: label.trim(), rank });
    return NextResponse.json(
      { id: doc._id.toString(), slug: doc.slug, label: doc.label, rank: doc.rank },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Slug or label already exists" }, { status: 409 });
  }
}
