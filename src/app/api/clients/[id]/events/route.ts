import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientEventModel } from "@/lib/models/ClientEvent";
import { recordActivity } from "@/lib/activity";
import { getUpcomingEventsForClient, getAllEventsForClient } from "@/lib/data";
import type { TimelineEvent, RecurrenceFrequency } from "@/types";

// ── Recurrence helpers (kept for POST response expansion) ────

const RECURRENCE_WINDOW_DAYS = 730; // 2 years

function nextOccurrenceDate(dateStr: string, recurrence: RecurrenceFrequency): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  let next: Date;
  switch (recurrence) {
    case "weekly":    next = new Date(y, m - 1, d + 7);  break;
    case "biweekly":  next = new Date(y, m - 1, d + 14); break;
    case "monthly":   next = new Date(y, m,     d);      break; // m-1+1 = m
    case "quarterly": next = new Date(y, m + 2, d);      break; // m-1+3 = m+2
    case "yearly":    next = new Date(y + 1, m - 1, d);  break;
    default:          return dateStr;
  }
  return next.toISOString().slice(0, 10);
}

function expandOccurrences(
  baseDate: string,
  recurrence: RecurrenceFrequency,
  today: string,
  windowEnd: string,
  repetitions?: number | null
): string[] {
  const occurrences: string[] = [];
  let current = baseDate;
  let totalCount = 0; // counts from baseDate, including past ones

  // Walk forward from baseDate, counting every occurrence (past or future)
  while (current <= windowEnd) {
    totalCount++;
    if (current >= today) occurrences.push(current);
    if (repetitions != null && totalCount >= repetitions) break;
    const next = nextOccurrenceDate(current, recurrence);
    if (next === current || next <= current) break; // safety guard
    current = next;
  }

  return occurrences;
}

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

  const { id: clientId } = await params;
  const body = await req.json();
  const { title, date, type, notes, recurrence, repetitions } = body;

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

  const validRecurrence: RecurrenceFrequency[] = ["none", "weekly", "biweekly", "monthly", "quarterly", "yearly"];
  const resolvedRecurrence: RecurrenceFrequency = validRecurrence.includes(recurrence) ? recurrence : "none";

  const resolvedRepetitions =
    resolvedRecurrence !== "none" && Number.isInteger(repetitions) && repetitions >= 1
      ? repetitions
      : undefined;

  await connectDB();
  const doc = await ClientEventModel.create({
    clientId,
    title: title.trim(),
    date: date.trim(),
    type,
    recurrence: resolvedRecurrence,
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
      recurrence: doc.recurrence,
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
    recurrence: doc.recurrence as RecurrenceFrequency,
  };

  return NextResponse.json(event, { status: 201 });
}
