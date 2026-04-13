import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { LeaveTypeModel, DEFAULT_LEAVE_TYPES } from "@/lib/models/LeaveType";

export async function GET() {
  await connectDB();

  // Upsert any missing defaults (preserves existing customised entries)
  await Promise.all(
    DEFAULT_LEAVE_TYPES.map((lt, i) =>
      LeaveTypeModel.updateOne(
        { slug: lt.slug },
        { $setOnInsert: { ...lt, rank: i } },
        { upsert: true }
      )
    )
  );

  const docs = await LeaveTypeModel.find().sort({ rank: 1, createdAt: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: d._id.toString(),
      slug: d.slug,
      label: d.label,
      color: d.color,
      icon: d.icon,
      rank: d.rank ?? 0,
      countsAgainstAllowance: d.countsAgainstAllowance ?? false,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.leaveTypes");
  if (forbidden) return forbidden;

  const { label, color, icon, countsAgainstAllowance } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  await connectDB();

  const existing = await LeaveTypeModel.findOne({ slug }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "A leave type with this name already exists" },
      { status: 409 }
    );
  }

  const last = await LeaveTypeModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  const doc = await LeaveTypeModel.create({
    slug,
    label: label.trim(),
    color: color ?? "#7c3aed",
    icon: icon ?? "Sun",
    rank,
    countsAgainstAllowance: countsAgainstAllowance ?? false,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      slug: doc.slug,
      label: doc.label,
      color: doc.color,
      icon: doc.icon,
      rank: doc.rank,
      countsAgainstAllowance: doc.countsAgainstAllowance,
    },
    { status: 201 }
  );
}
