import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { LogModel } from "@/lib/models/Log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { logId } = await params;
  await connectDB();
  const existing = await LogModel.findById(logId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.isAdmin ?? false;
  const isCreator = existing.createdById === session.user.id;

  const body = await req.json();
  const { contactId, date, summary, signalIds, followUp, followUpDeadline, followedUpAt, followedUpByName } = body;

  const isEditAction = date !== undefined || summary !== undefined || signalIds !== undefined || followUp !== undefined || contactId !== undefined;
  if (isEditAction && !isAdmin && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (date !== undefined && !date?.trim()) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  if (summary !== undefined && !summary?.trim()) {
    return NextResponse.json({ error: "Summary is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};

  if (contactId !== undefined) update.contactId = contactId || undefined;
  if (date !== undefined) update.date = date.trim();
  if (summary !== undefined) update.summary = summary.trim();
  if (signalIds !== undefined) update.signalIds = Array.isArray(signalIds) ? signalIds : [];
  if (followUp !== undefined) {
    update.followUp = !!followUp;
    update.followUpDeadline = followUp && followUpDeadline ? followUpDeadline : undefined;
  }
  if (followedUpAt !== undefined) {
    if (followedUpAt === null) {
      unset.followedUpAt = 1;
      unset.followedUpByName = 1;
    } else {
      update.followedUpAt = followedUpAt;
      update.followedUpByName = followedUpByName ?? undefined;
    }
  }

  const mongoUpdate: Record<string, unknown> = {};
  if (Object.keys(update).length > 0) mongoUpdate.$set = update;
  if (Object.keys(unset).length > 0) mongoUpdate.$unset = unset;

  const doc = await LogModel.findByIdAndUpdate(logId, mongoUpdate, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    contactId: doc.contactId ?? undefined,
    date: doc.date,
    summary: doc.summary,
    signalIds: doc.signalIds ?? [],
    followUp: doc.followUp ?? false,
    followUpDeadline: doc.followUpDeadline ?? undefined,
    followedUpAt: doc.followedUpAt ?? undefined,
    followedUpByName: doc.followedUpByName ?? undefined,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { logId } = await params;
  await connectDB();
  const existing = await LogModel.findById(logId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.isAdmin ?? false;
  const isCreator = existing.createdById === session.user.id;
  if (!isAdmin && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await LogModel.findByIdAndDelete(logId);
  return new NextResponse(null, { status: 204 });
}
