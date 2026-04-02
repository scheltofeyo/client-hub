import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientStatusOptionModel, DEFAULT_CLIENT_STATUSES } from "@/lib/models/ClientStatusOption";

export async function GET() {
  await connectDB();
  let docs = await ClientStatusOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();

  if (docs.length === 0) {
    await Promise.all(
      DEFAULT_CLIENT_STATUSES.map((s, i) =>
        ClientStatusOptionModel.create({ ...s, rank: i })
      )
    );
    docs = await ClientStatusOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  }

  return NextResponse.json(
    docs.map((d) => ({ id: d._id.toString(), slug: d.slug, label: d.label, rank: d.rank ?? 0, checkInDays: d.checkInDays ?? null }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { label, checkInDays } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const slug = label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!slug) {
    return NextResponse.json({ error: "Could not generate a valid slug from label" }, { status: 400 });
  }

  const parsedDays = checkInDays != null && checkInDays !== "" ? Number(checkInDays) : null;

  await connectDB();
  const last = await ClientStatusOptionModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  try {
    const doc = await ClientStatusOptionModel.create({ slug, label: label.trim(), rank, checkInDays: parsedDays });
    return NextResponse.json(
      { id: doc._id.toString(), slug: doc.slug, label: doc.label, rank: doc.rank, checkInDays: doc.checkInDays ?? null },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Slug or label already exists" }, { status: 409 });
  }
}
