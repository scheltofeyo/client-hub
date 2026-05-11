import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { SessionModel } from "@/lib/models/Session";
import { ProjectModel } from "@/lib/models/Project";
import { recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/auth-helpers";
import type { SessionParticipant } from "@/types";

function normalizeParticipants(input: unknown): SessionParticipant[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => {
      if (typeof p !== "object" || p === null) return null;
      const email = typeof (p as { email?: unknown }).email === "string"
        ? ((p as { email: string }).email).trim()
        : "";
      if (!email) return null;
      const name = typeof (p as { name?: unknown }).name === "string"
        ? ((p as { name: string }).name).trim()
        : "";
      return { email, ...(name ? { name } : {}) };
    })
    .filter((p): p is SessionParticipant => p !== null);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; sessionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requirePermission(session, "sessions.edit");
  if (forbidden) return forbidden;

  const { id, projectId, sessionId } = await params;
  await connectDB();

  const body = await req.json();
  const { title, date, location, remoteLink, participants, info } = body;

  const update: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};

  if (title !== undefined) {
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    update.title = title.trim();
  }
  if (date !== undefined) {
    if (date?.trim()) update.date = date.trim();
    else unset.date = 1;
  }
  if (location !== undefined) {
    if (location?.trim()) update.location = location.trim();
    else unset.location = 1;
  }
  if (remoteLink !== undefined) {
    if (remoteLink?.trim()) update.remoteLink = remoteLink.trim();
    else unset.remoteLink = 1;
  }
  if (info !== undefined) {
    if (info?.trim()) update.info = info.trim();
    else unset.info = 1;
  }
  if (participants !== undefined) {
    update.participants = normalizeParticipants(participants);
  }

  const updateOp: Record<string, unknown> = {};
  if (Object.keys(update).length > 0) updateOp.$set = update;
  if (Object.keys(unset).length > 0) updateOp.$unset = unset;

  const doc = await SessionModel.findOneAndUpdate(
    { _id: sessionId, projectId },
    updateOp,
    { new: true }
  ).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trackFields = ["title", "date", "location", "remoteLink", "participants", "info"] as const;
  const updatedFields = trackFields.filter((f) => body[f] !== undefined);
  if (updatedFields.length > 0) {
    const project = await ProjectModel.findById(projectId, { status: 1 }).lean();
    if (project?.status !== "draft") {
      await recordActivity({
        clientId: id,
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "session.updated",
        metadata: { projectId, sessionId, title: doc.title, fields: updatedFields },
      });
    }
  }

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    projectId: doc.projectId,
    title: doc.title,
    date: doc.date ?? null,
    location: doc.location ?? null,
    remoteLink: doc.remoteLink ?? null,
    participants: doc.participants ?? [],
    info: doc.info ?? null,
    templateSessionId: doc.templateSessionId ?? null,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string; sessionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requirePermission(session, "sessions.delete");
  if (forbidden) return forbidden;

  const { id, projectId, sessionId } = await params;
  await connectDB();

  const project = await ProjectModel.findById(projectId, { status: 1 }).lean();
  const doc = await SessionModel.findOneAndDelete({ _id: sessionId, projectId }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (project?.status !== "draft") {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "session.deleted",
      metadata: { projectId, sessionId, title: doc.title },
    });
  }

  return NextResponse.json({ success: true });
}
