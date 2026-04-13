import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ClientEventModel } from "@/lib/models/ClientEvent";
import { recordActivity } from "@/lib/activity";
import { getUpcomingEventsForClient, getAllEventsForClient } from "@/lib/data";
import type { TimelineEvent, RecurrenceUnit } from "@/types";

const VALID_RECURRENCE_UNITS: RecurrenceUnit[] = ["days", "weeks", "months", "years"];

// ── Handlers ──────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const scope = req.nextUrl.searchParams.get("scope") ?? "all";
  const events = scope === "upcoming"
    ? await getUpcomingEventsForClient(clientId)
    : await getAllEventsForClient(clientId);
  return NextResponse.json(events);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, "events.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const body = await req.json();
  const { title, date, type, notes, recurrenceInterval, recurrenceUnit, repetitions } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!date?.trim()) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    return NextResponse.json(
      { error: "Event date must be today or in the future" },
      { status: 400 }
    );
  }

  const hasRecurrence =
    Number.isInteger(recurrenceInterval) && recurrenceInterval >= 1 &&
    VALID_RECURRENCE_UNITS.includes(recurrenceUnit);

  const resolvedRepetitions =
    hasRecurrence && Number.isInteger(repetitions) && repetitions >= 1
      ? repetitions
      : undefined;

  await connectDB();
  const doc = await ClientEventModel.create({
    clientId,
    title: title.trim(),
    date: date.trim(),
    type,
    recurrence: hasRecurrence ? "custom" : "none",
    recurrenceInterval: hasRecurrence ? recurrenceInterval : undefined,
    recurrenceUnit: hasRecurrence ? recurrenceUnit : undefined,
    repetitions: resolvedRepetitions,
    notes: notes?.trim() || undefined,
    createdById: session.user.id,
    createdByName: session.user.name ?? "Unknown",
  });

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "event.created",
    metadata: {
      eventId: doc._id.toString(),
      title: doc.title,
      date: doc.date,
      eventType: doc.type,
      recurrenceInterval: doc.recurrenceInterval,
      recurrenceUnit: doc.recurrenceUnit,
    },
  });

  const event: TimelineEvent = {
    id: `custom_${doc._id.toString()}`,
    date: doc.date,
    title: doc.title,
    type: doc.type,
    source: "custom",
    sourceId: doc._id.toString(),
    notes: doc.notes ?? undefined,
    deletable: true,
    recurrenceInterval: doc.recurrenceInterval ?? undefined,
    recurrenceUnit: (doc.recurrenceUnit as RecurrenceUnit) ?? undefined,
  };

  return NextResponse.json(event, { status: 201 });
}
