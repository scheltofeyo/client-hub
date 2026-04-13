import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TimeOffModel } from "@/lib/models/TimeOff";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const existing = await TimeOffModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwn = existing.userId.toString() === session.user.id;
  if (isOwn) {
    const forbidden = requirePermission(session, "team.manageOwnLeave");
    if (forbidden) return forbidden;
  } else {
    const forbidden = requirePermission(session, "team.manageAnyLeave");
    if (forbidden) return forbidden;
  }

  const { startDate, endDate, startDayPortion, endDayPortion, leaveTypeSlug, notes } = await req.json();

  const updates: Record<string, unknown> = {};
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (startDayPortion !== undefined) updates.startDayPortion = startDayPortion;
  if (endDayPortion !== undefined) updates.endDayPortion = endDayPortion;
  if (leaveTypeSlug !== undefined) updates.leaveTypeSlug = leaveTypeSlug;
  if (notes !== undefined) updates.notes = notes?.slice(0, 200);

  const newStart = (updates.startDate ?? existing.startDate) as string;
  const newEnd = (updates.endDate ?? existing.endDate) as string;
  if (newEnd < newStart) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }

  // Check for overlapping entries (excluding this one)
  const overlap = await TimeOffModel.findOne({
    _id: { $ne: id },
    userId: existing.userId,
    status: "confirmed",
    startDate: { $lte: newEnd },
    endDate: { $gte: newStart },
  }).lean();

  if (overlap) {
    return NextResponse.json(
      { error: "This time off overlaps with an existing entry" },
      { status: 409 }
    );
  }

  const doc = await TimeOffModel.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    startDate: doc.startDate,
    endDate: doc.endDate,
    startDayPortion: doc.startDayPortion,
    endDayPortion: doc.endDayPortion,
    leaveTypeSlug: doc.leaveTypeSlug,
    notes: doc.notes,
    status: doc.status,
    createdById: doc.createdById.toString(),
    createdByName: doc.createdByName,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const existing = await TimeOffModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwn = existing.userId.toString() === session.user.id;
  if (isOwn) {
    const forbidden = requirePermission(session, "team.manageOwnLeave");
    if (forbidden) return forbidden;
  } else {
    const forbidden = requirePermission(session, "team.manageAnyLeave");
    if (forbidden) return forbidden;
  }

  await TimeOffModel.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
