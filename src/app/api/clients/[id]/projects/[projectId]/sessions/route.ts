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

function serialize(doc: {
  _id: { toString: () => string };
  clientId: string;
  projectId: string;
  title: string;
  date?: string | null;
  location?: string | null;
  remoteLink?: string | null;
  participants?: SessionParticipant[];
  info?: string | null;
  order?: number | null;
  templateSessionId?: string | null;
  createdById: string;
  createdByName: string;
  createdAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    projectId: doc.projectId,
    title: doc.title,
    date: doc.date ?? null,
    location: doc.location ?? null,
    remoteLink: doc.remoteLink ?? null,
    participants: doc.participants ?? [],
    info: doc.info ?? null,
    order: doc.order ?? 0,
    templateSessionId: doc.templateSessionId ?? null,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  await connectDB();
  const docs = await SessionModel.find({ projectId }).sort({ order: 1, date: 1, createdAt: 1 }).lean();
  return NextResponse.json(docs.map(serialize));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requirePermission(session, "sessions.create");
  if (forbidden) return forbidden;

  const { id, projectId } = await params;
  await connectDB();

  const body = await req.json();
  const { title, date, location, remoteLink, participants, info } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const project = await ProjectModel.findById(projectId, { status: 1 }).lean();

  const last = await SessionModel.findOne({ projectId }).sort({ order: -1 }).lean();
  const order = last ? (last.order ?? 0) + 1 : 0;

  const doc = await SessionModel.create({
    clientId: id,
    projectId,
    title: title.trim(),
    date: date?.trim() || undefined,
    location: location?.trim() || undefined,
    remoteLink: remoteLink?.trim() || undefined,
    participants: normalizeParticipants(participants),
    info: info?.trim() || undefined,
    order,
    createdById: session.user.id,
    createdByName: session.user.name ?? "Unknown",
  });

  // Suppress activity for draft projects — they are still inside an unaccepted plan.
  if (project?.status !== "draft") {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "session.created",
      metadata: { projectId, sessionId: doc._id.toString(), title: doc.title },
    });
  }

  return NextResponse.json(serialize(doc.toObject()), { status: 201 });
}
