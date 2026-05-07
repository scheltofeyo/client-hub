"use client";

import Link from "next/link";
import { CalendarDays, Repeat } from "lucide-react";
import type { EventType, TimelineEvent } from "@/types";
import { resolveClientColor } from "@/lib/styles";

export type UpcomingEvent = TimelineEvent & {
  clientId: string;
  clientName: string;
  clientPrimaryColor?: string;
};

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function monogram(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function endOfWeekISO(todayISO: string): string {
  const [y, m, d] = todayISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0 = Sunday
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  date.setDate(date.getDate() + daysUntilSunday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function endOfMonthISO(todayISO: string): string {
  const [y, m] = todayISO.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

interface Props {
  events: UpcomingEvent[];
  eventTypes: EventType[];
  todayISO: string;
}

export default function MyDayUpcomingEventsSection({ events, eventTypes, todayISO }: Props) {
  const weekEnd = endOfWeekISO(todayISO);
  const monthEnd = endOfMonthISO(todayISO);

  const today = events.filter((e) => e.date === todayISO);
  const thisWeek = events.filter((e) => e.date > todayISO && e.date <= weekEnd);
  const thisMonth = events.filter((e) => e.date > weekEnd && e.date <= monthEnd);

  const total = today.length + thisWeek.length + thisMonth.length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Upcoming events</h2>
        {total > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {total}
          </span>
        )}
      </div>

      <div className="flex gap-4 items-stretch">
        <Column title="Today" emptyText="Nothing today" events={today} eventTypes={eventTypes} />
        <Column title="This week" emptyText="Nothing this week" events={thisWeek} eventTypes={eventTypes} />
        <Column title="This month" emptyText="Nothing this month" events={thisMonth} eventTypes={eventTypes} />
      </div>
    </div>
  );
}

function Column({
  title,
  emptyText,
  events,
  eventTypes,
}: {
  title: string;
  emptyText: string;
  events: UpcomingEvent[];
  eventTypes: EventType[];
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>{title}</h3>
        {events.length > 0 && (
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {events.length}
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <div
          className="rounded-xl border p-4 text-center flex-1 flex items-center justify-center"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <CalendarDays size={18} style={{ color: "var(--text-muted)" }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emptyText}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} eventTypes={eventTypes} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, eventTypes }: { event: UpcomingEvent; eventTypes: EventType[] }) {
  const et = eventTypes.find((e) => e.slug === event.type);
  const color = et?.color ?? "var(--text-muted)";
  const label = et?.label ?? event.type;

  const [, mm, dd] = event.date.split("-");
  const monthStr = MONTHS[parseInt(mm) - 1];
  const dayStr = parseInt(dd).toString();

  const isRecurring = !!(event.recurrenceInterval && event.recurrenceUnit);
  const { bg, fg } = resolveClientColor(event.clientName, event.clientPrimaryColor);

  return (
    <Link
      href={`/clients/${event.clientId}?tab=events`}
      className="flex rounded-xl border overflow-hidden transition-opacity hover:opacity-80"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div
        className="flex flex-col items-center justify-center shrink-0 px-3 py-3 gap-0.5"
        style={{
          width: 56,
          background: `linear-gradient(160deg, ${color}30 0%, ${color}12 100%)`,
          borderRight: "1px solid var(--border)",
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest leading-none" style={{ color }}>
          {monthStr}
        </span>
        <span className="typo-metric leading-none mt-0.5" style={{ color: "var(--text-primary)" }}>
          {dayStr}
        </span>
      </div>
      <div className="flex flex-col flex-1 min-w-0 px-3 py-2.5 gap-1">
        <div className="flex items-center gap-1.5">
          <span className="typo-tag truncate" style={{ color }}>
            {label}
          </span>
          {isRecurring && <Repeat size={10} style={{ color: "var(--text-muted)" }} />}
        </div>
        <p className="typo-card-title leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {event.title}
        </p>
        <div className="flex items-center gap-1.5 mt-auto pt-1 min-w-0">
          <div
            className="w-4 h-4 rounded flex-none flex items-center justify-center text-[9px] font-bold"
            style={{ background: bg, color: fg }}
          >
            {monogram(event.clientName)}
          </div>
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {event.clientName}
          </span>
        </div>
      </div>
    </Link>
  );
}
