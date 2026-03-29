import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { LogModel } from "@/lib/models/Log";
import { TaskModel } from "@/lib/models/Task";
import { recordActivity } from "@/lib/activity";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId, logId } = await params;
  await connectDB();
  const existing = await LogModel.findById(logId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.isAdmin ?? false;
  const isCreator = existing.createdById === session.user.id;

  const body = await req.json();
  const { contactIds, date, summary, signalIds, followUp, followUpAction, followUpDeadline, followedUpAt, followedUpByName } = body;

  const isEditAction = date !== undefined || summary !== undefined || signalIds !== undefined || followUp !== undefined || contactIds !== undefined;
  if (isEditAction && !isAdmin && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (date !== undefined && !date?.trim()) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  if (summary !== undefined && !summary?.trim()) {
    return NextResponse.json({ error: "Summary is required" }, { status: 400 });
  }
  if (followUp && !followUpAction?.trim()) {
    return NextResponse.json({ error: "A follow-up action is required when follow-up is enabled." }, { status: 400 });
  }

  const existingFollowUpTaskId = existing.followUpTaskId as string | undefined;

  const update: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};

  if (contactIds !== undefined) update.contactIds = Array.isArray(contactIds) ? contactIds : [];
  if (date !== undefined) update.date = date.trim();
  if (summary !== undefined) update.summary = summary.trim();
  if (signalIds !== undefined) update.signalIds = Array.isArray(signalIds) ? signalIds : [];
  if (followUp !== undefined) {
    update.followUp = !!followUp;
    update.followUpAction = followUp && followUpAction ? followUpAction.trim() : undefined;
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

  // ── Sync follow-up task ──────────────────────────────────────
  if (followUp !== undefined) {
    if (followUp === true) {
      const taskTitle = (followUpAction ?? existing.followUpAction ?? "").trim();
      const taskDeadline = followUpDeadline ?? existing.followUpDeadline;
      if (taskTitle) {
        if (existingFollowUpTaskId) {
          await TaskModel.findByIdAndUpdate(existingFollowUpTaskId, {
            $set: { title: taskTitle, completionDate: taskDeadline || null },
          });
        } else {
          const task = await TaskModel.create({
            clientId,
            logId,
            title: taskTitle,
            completionDate: taskDeadline || undefined,
            createdById: session.user.id,
            createdByName: session.user.name ?? "Unknown",
          });
          update.followUpTaskId = task._id.toString();
        }
      }
    } else {
      // followUp disabled — delete linked task
      if (existingFollowUpTaskId) {
        await TaskModel.findByIdAndDelete(existingFollowUpTaskId);
      }
      unset.followUpTaskId = 1;
    }
  }

  // ── Sync task completion when followedUpAt changes ───────────
  if (followedUpAt !== undefined && existingFollowUpTaskId) {
    if (followedUpAt !== null) {
      await TaskModel.findByIdAndUpdate(existingFollowUpTaskId, {
        $set: {
          completedAt: new Date().toISOString(),
          completedById: session.user.id,
          completedByName: session.user.name ?? "Unknown",
        },
      });
    } else {
      await TaskModel.findByIdAndUpdate(existingFollowUpTaskId, {
        $unset: { completedAt: 1, completedById: 1, completedByName: 1 },
      });
    }
  }

  const mongoUpdate: Record<string, unknown> = {};
  if (Object.keys(update).length > 0) mongoUpdate.$set = update;
  if (Object.keys(unset).length > 0) mongoUpdate.$unset = unset;

  const doc = await LogModel.findByIdAndUpdate(logId, mongoUpdate, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (followedUpAt !== undefined && followedUpAt !== null) {
    await recordActivity({
      clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "log.followedup",
      metadata: { logId, summary: doc.summary.slice(0, 80), followUpAction: doc.followUpAction ?? undefined },
    });
  } else if (isEditAction) {
    await recordActivity({
      clientId,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "log.updated",
      metadata: { logId, summary: doc.summary.slice(0, 80) },
    });
  }

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    contactIds: doc.contactIds?.length ? doc.contactIds : (doc.contactId ? [doc.contactId] : []),
    date: doc.date,
    summary: doc.summary,
    signalIds: doc.signalIds ?? [],
    followUp: doc.followUp ?? false,
    followUpAction: doc.followUpAction ?? undefined,
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

  const { id: clientId, logId } = await params;
  await connectDB();
  const existing = await LogModel.findById(logId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.isAdmin ?? false;
  const isCreator = existing.createdById === session.user.id;
  if (!isAdmin && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await LogModel.findByIdAndDelete(logId);

  // Clean up the derived follow-up task
  if (existing.followUpTaskId) {
    await TaskModel.findByIdAndDelete(existing.followUpTaskId as string);
  }

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "log.deleted",
    metadata: { logId, summary: existing.summary.slice(0, 80) },
  });

  return new NextResponse(null, { status: 204 });
}
