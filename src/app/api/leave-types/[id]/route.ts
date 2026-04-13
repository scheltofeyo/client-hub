import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { LeaveTypeModel, DEFAULT_LEAVE_TYPES } from "@/lib/models/LeaveType";

const SYSTEM_SLUGS = new Set(DEFAULT_LEAVE_TYPES.map((lt) => lt.slug));

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.leaveTypes");
  if (forbidden) return forbidden;

  const { id } = await params;
  const { label, color, icon, countsAgainstAllowance } = await req.json();

  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  await connectDB();

  const doc = await LeaveTypeModel.findByIdAndUpdate(
    id,
    { $set: { label: label.trim(), color, icon, countsAgainstAllowance: countsAgainstAllowance ?? false } },
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
    countsAgainstAllowance: doc.countsAgainstAllowance,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.leaveTypes");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await LeaveTypeModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (SYSTEM_SLUGS.has(doc.slug)) {
    return NextResponse.json({ error: "System leave types cannot be deleted" }, { status: 400 });
  }

  await LeaveTypeModel.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
