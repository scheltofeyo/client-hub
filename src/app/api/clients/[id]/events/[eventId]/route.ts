import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientEventModel } from "@/lib/models/ClientEvent";
import { recordActivity } from "@/lib/activity";
import type { RecurrenceUnit } from "@/types";

const VALID_UNITS: RecurrenceUnit[] = ["days", "weeks", "months", "years"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId, eventId } = await params;
  const body = await req.json();

  await connectDB();
  const doc = await ClientEventModel.findById(eventId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.clientId !== clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (body.title?.trim())  doc.title = body.title.trim();
  if (body.date?.trim())   doc.date  = body.date.trim();
  if (body.type)           doc.type  = body.type;
  if (body.notes !== undefined) doc.notes = body.notes?.trim() || undefined;

  // Recurrence: if interval+unit provided, set them; if both absent, clear recurrence
  if (Number.isInteger(body.recurrenceInterval) && body.recurrenceInterval >= 1 && VALID_UNITS.includes(body.recurrenceUnit)) {
    doc.recurrenceInterval = body.recurrenceInterval;
    doc.recurrenceUnit = body.recurrenceUnit;
    doc.recurrence = "custom" as typeof doc.recurrence;
  } else if (body.recurrenceInterval === undefined && body.recurrenceUnit === undefined) {
    doc.recurrenceInterval = undefined;
    doc.recurrenceUnit = undefined;
    doc.recurrence = "none";
  }

  // repetitions: null clears it (unlimited); positive integer sets it
  if (body.repetitions === null) {
    doc.repetitions = undefined;
  } else if (Number.isInteger(body.repetitions) && body.repetitions >= 1) {
    doc.repetitions = body.repetitions;
  }

  await doc.save();

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "event.updated",
    metadata: { eventId, title: doc.title, recurrenceInterval: doc.recurrenceInterval, recurrenceUnit: doc.recurrenceUnit },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId, eventId } = await params;

  await connectDB();
  const doc = await ClientEventModel.findById(eventId).lean();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ClientEventModel.findByIdAndDelete(eventId);

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "event.deleted",
    metadata: { eventId, title: doc.title, date: doc.date },
  });

  return new NextResponse(null, { status: 204 });
}
