"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  AlarmClock,
  Users,
  Clock,
  Flag,
  Circle,
  Star,
  Bell,
  Zap,
  Briefcase,
  Tag,
  PackageCheck,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { fmtDate } from "@/lib/utils";
import type { EventType, TimelineEvent, RecurrenceUnit } from "@/types";

/** System event type slugs that should not be user-selectable */
const SYSTEM_EVENT_TYPE_SLUGS: readonly string[] = ["deadline", "delivery", "follow_up", "expired_service"];

// ── Helpers ──────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function relativeLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "In 1 week";
  if (days < 31) return `In ${Math.round(days / 7)} weeks`;
  if (days < 60) return "In ~1 month";
  return `In ~${Math.round(days / 30)} months`;
}

function eventNavUrl(clientId: string, event: TimelineEvent): string | null {
  switch (event.source) {
    case "log_followup":
      return `/clients/${clientId}?tab=Logbook`;
    case "task":
      return event.projectId
        ? `/clients/${clientId}/projects/${event.projectId}/tasks`
        : null;
    case "project":
      return `/clients/${clientId}/projects/${event.sourceId}/tasks`;
    case "custom":
    default:
      return null;
  }
}

function sourceLabel(event: TimelineEvent): string {
  switch (event.source) {
    case "log_followup": return "Logbook follow-up";
    case "task":         return "Task deadline";
    case "project":      return "Project";
    case "custom":         return "";
    default:               return "";
  }
}

// ── Recurrence ───────────────────────────────────────────────

const RECURRENCE_UNIT_OPTIONS: { value: RecurrenceUnit; label: string }[] = [
  { value: "days",   label: "days"   },
  { value: "weeks",  label: "weeks"  },
  { value: "months", label: "months" },
  { value: "years",  label: "years"  },
];

function recurrenceLabel(interval: number, unit: RecurrenceUnit): string {
  if (interval === 1) {
    const singular: Record<RecurrenceUnit, string> = { days: "day", weeks: "week", months: "month", years: "year" };
    return `Every ${singular[unit]}`;
  }
  return `Every ${interval} ${unit}`;
}

/** Map legacy recurrence strings to interval + unit for edit form */
function legacyToIntervalUnit(recurrence: string): { interval: number; unit: RecurrenceUnit } | null {
  switch (recurrence) {
    case "weekly":    return { interval: 1, unit: "weeks" };
    case "biweekly":  return { interval: 2, unit: "weeks" };
    case "monthly":   return { interval: 1, unit: "months" };
    case "quarterly": return { interval: 3, unit: "months" };
    case "yearly":    return { interval: 1, unit: "years" };
    default:          return null;
  }
}

// ── Type colours & icons ─────────────────────────────────────

const ICON_REGISTRY: Record<string, React.ElementType> = {
  Users, Clock, Flag, Circle, CalendarDays, Star, Bell, Zap, Briefcase, Tag,
  AlarmClock, CheckSquare, FolderOpen, PackageCheck,
};

const SYSTEM_TYPE_CONFIG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  follow_up:          { color: "#3b82f6", label: "Follow-up", icon: AlarmClock   },
  project_completion: { color: "var(--primary)", label: "Project", icon: FolderOpen },
};

function buildTypeConfig(
  eventTypes: EventType[]
): Record<string, { color: string; label: string; icon: React.ElementType }> {
  const config: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    ...SYSTEM_TYPE_CONFIG,
  };
  for (const et of eventTypes) {
    config[et.slug] = {
      color: et.color,
      label: et.label,
      icon: ICON_REGISTRY[et.icon] ?? Circle,
    };
  }
  return config;
}

function getTypeCfg(
  type: string,
  typeConfig: Record<string, { color: string; label: string; icon: React.ElementType }>
) {
  return typeConfig[type] ?? { color: "var(--text-muted)", label: type, icon: Circle };
}

// ── EventForm ─────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

interface EventFormProps {
  clientId: string;
  eventTypes: EventType[];
  onSaved: () => void | Promise<void>;
  onClose: () => void;
  /** When set, the form PATCHes instead of POSTing */
  editEvent?: {
    id: string;
    title: string;
    date: string;
    type: string;
    notes?: string;
    recurrenceInterval?: number;
    recurrenceUnit?: RecurrenceUnit;
    /** @deprecated old format */
    recurrence?: string;
    repetitions?: number;
  };
}

function resolveEditRecurrence(editEvent?: EventFormProps["editEvent"]): { interval: number; unit: RecurrenceUnit } | null {
  if (!editEvent) return null;
  if (editEvent.recurrenceInterval && editEvent.recurrenceUnit) {
    return { interval: editEvent.recurrenceInterval, unit: editEvent.recurrenceUnit };
  }
  if (editEvent.recurrence && editEvent.recurrence !== "none") {
    return legacyToIntervalUnit(editEvent.recurrence);
  }
  return null;
}

export function EventForm({ clientId, eventTypes, onSaved, onClose, editEvent }: EventFormProps) {
  const userTypes = eventTypes.filter((et) => !SYSTEM_EVENT_TYPE_SLUGS.includes(et.slug));
  const defaultSlug = userTypes[0]?.slug ?? "other";
  const editRec = resolveEditRecurrence(editEvent);
  const [form, setForm] = useState({
    title:              editEvent?.title ?? "",
    date:               editEvent?.date  ?? "",
    type:               editEvent?.type  ?? defaultSlug,
    notes:              editEvent?.notes ?? "",
    recurring:          !!editRec,
    recurrenceInterval: editRec?.interval ?? 1,
    recurrenceUnit:     editRec?.unit ?? ("months" as RecurrenceUnit),
    hasRepetitions:     editEvent?.repetitions != null,
    repetitions:        editEvent?.repetitions != null ? String(editEvent.repetitions) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!editEvent;

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setLoading(true);
    setError("");

    const url = isEdit
      ? `/api/clients/${clientId}/events/${editEvent!.id}`
      : `/api/clients/${clientId}/events`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:              form.title,
        date:               form.date,
        type:               form.type,
        notes:              form.notes || undefined,
        recurrenceInterval: form.recurring ? form.recurrenceInterval : undefined,
        recurrenceUnit:     form.recurring ? form.recurrenceUnit : undefined,
        // null clears repetitions (unlimited); integer sets the cap
        repetitions:        form.recurring && form.hasRepetitions && form.repetitions !== ""
          ? parseInt(form.repetitions, 10)
          : (isEdit ? null : undefined),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ev-title" className={labelClass} style={labelStyle}>
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="ev-title"
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          autoFocus
          placeholder="e.g. Quarterly review"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="ev-date" className={labelClass} style={labelStyle}>
          {form.recurring ? "Start date" : "Date"} <span className="text-red-400">*</span>
        </label>
        <input
          id="ev-date"
          type="date"
          value={form.date}
          min={isEdit ? undefined : today()}
          onChange={(e) => set("date", e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <p className={labelClass} style={labelStyle}>Type</p>
        <div className="flex gap-2 flex-wrap">
          {userTypes.map((et) => {
            const Icon = ICON_REGISTRY[et.icon] ?? Circle;
            const active = form.type === et.slug;
            return (
              <button
                key={et.slug}
                type="button"
                onClick={() => set("type", et.slug)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={
                  active
                    ? { background: et.color, color: "#fff", borderColor: et.color }
                    : { background: "var(--bg-sidebar)", color: "var(--text-primary)", borderColor: "var(--border)" }
                }
              >
                <Icon size={11} />
                {et.label}
              </button>
            );
          })}
        </div>
      </div>
      {/* Recurrence toggle row */}
      <div>
        <p className={labelClass} style={labelStyle}>Recurrence</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={form.recurring}
            onClick={() => set("recurring", !form.recurring)}
            className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors"
            style={{ background: form.recurring ? "var(--primary)" : "var(--border)" }}
          >
            <span
              className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: form.recurring ? "translateX(16px)" : "translateX(0)" }}
            />
          </button>
          {form.recurring && (
            <>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Every</span>
              <input
                type="number"
                min={1}
                value={form.recurrenceInterval}
                onChange={(e) => set("recurrenceInterval", Math.max(1, parseInt(e.target.value) || 1))}
                className={inputClass}
                style={{ ...inputStyle, width: 60, textAlign: "center" }}
              />
              <select
                value={form.recurrenceUnit}
                onChange={(e) => set("recurrenceUnit", e.target.value as RecurrenceUnit)}
                className={inputClass}
                style={{ ...inputStyle, width: "auto", paddingRight: 24 }}
              >
                {RECURRENCE_UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
      {/* Repetitions toggle row — only visible when recurring */}
      {form.recurring && (
        <div>
          <p className={labelClass} style={labelStyle}>Repetitions</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.hasRepetitions}
              onClick={() => set("hasRepetitions", !form.hasRepetitions)}
              className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors"
              style={{ background: form.hasRepetitions ? "var(--primary)" : "var(--border)" }}
            >
              <span
                className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: form.hasRepetitions ? "translateX(16px)" : "translateX(0)" }}
              />
            </button>
            {form.hasRepetitions ? (
              <>
                <input
                  type="number"
                  min={1}
                  value={form.repetitions}
                  onChange={(e) => set("repetitions", e.target.value)}
                  placeholder="e.g. 10"
                  className={inputClass}
                  style={{ ...inputStyle, width: 70, textAlign: "center" }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  occurrence{form.repetitions !== "" && parseInt(form.repetitions) === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Unlimited</span>
            )}
          </div>
        </div>
      )}
      <div>
        <label htmlFor="ev-notes" className={labelClass} style={labelStyle}>
          Notes
        </label>
        <textarea
          id="ev-notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Optional details…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !form.title.trim() || !form.date}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Saving…" : isEdit ? "Save changes" : "Add Event"}
        </button>
      </div>
    </form>
  );
}

// ── EventCard ─────────────────────────────────────────────────

function EventCard({
  event,
  onDelete,
  onEdit,
  clientId,
  typeConfig,
  hideDate,
  isPast,
}: {
  event: TimelineEvent;
  onDelete: (event: TimelineEvent) => void;
  onEdit: (event: TimelineEvent) => void;
  clientId: string;
  typeConfig: Record<string, { color: string; label: string; icon: React.ElementType }>;
  hideDate?: boolean;
  isPast?: boolean;
}) {
  const router = useRouter();
  const cfg = getTypeCfg(event.type, typeConfig);
  const Icon = cfg.icon;
  const url = eventNavUrl(clientId, event);
  const isRecurring = !!(event.recurrenceInterval && event.recurrenceUnit);

  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const [, mm, dd] = event.date.split("-");
  const monthLabel = MONTHS[parseInt(mm) - 1];
  const dayLabel   = parseInt(dd).toString();

  return (
    <div
      onClick={url ? () => router.push(url) : undefined}
      className={`flex rounded-xl border overflow-hidden transition-all shrink-0${url ? " cursor-pointer hover:shadow-md" : ""}`}
      style={{
        width: 340,
        borderColor: "var(--border)",
        background: "var(--bg-sidebar)",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
        opacity: isPast ? 0.55 : 1,
      }}
    >
      {/* ── Left: date only ── */}
      {!hideDate && (
        <div
          className="flex flex-col items-center justify-center shrink-0 px-3 py-3 gap-1"
          style={{
            width: 76,
            background: `linear-gradient(160deg, ${cfg.color}30 0%, ${cfg.color}12 100%)`,
            borderRight: "1px solid var(--border)",
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest leading-none"
            style={{ color: cfg.color }}
          >
            {monthLabel}
          </span>
          <span
            className="text-3xl font-bold tabular-nums leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {dayLabel}
          </span>
        </div>
      )}

      {/* ── Right: content ── */}
      <div className="flex flex-col flex-1 min-w-0 px-3.5 py-3 gap-1">
        {/* Type label row — edit/delete buttons sit here for deletable events */}
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: cfg.color }}
          >
            <Icon size={10} strokeWidth={2} />
            {cfg.label}
          </span>
          <div className="flex-1" />
          {event.deletable && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-muted)" }}
                aria-label="Edit event"
              >
                <Pencil size={11} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(event); }}
                className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-muted)" }}
                aria-label={isRecurring ? "Delete all occurrences" : "Delete event"}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {event.title}
        </p>

        {/* Notes */}
        {event.notes && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {event.notes}
          </p>
        )}

        {/* Footer: recurrence badge */}
        {isRecurring && (
          <div className="flex items-center gap-2 mt-auto pt-0.5">
            <span
              className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
            >
              <RefreshCw size={9} strokeWidth={2.5} />
              {recurrenceLabel(event.recurrenceInterval!, event.recurrenceUnit!)}
              {event.repetitions != null && ` · ${event.repetitions}×`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Groups ────────────────────────────────────────────────────

const GROUPS: { label: string; min: number; max: number }[] = [
  // Past groups (oldest first)
  { label: "Over 6 months ago", min: -Infinity, max: -181 },
  { label: "Past 6 months",     min: -180,      max: -91  },
  { label: "Past 3 months",     min: -90,       max: -31  },
  { label: "Last month",        min: -30,       max: -8   },
  { label: "Last week",         min: -7,        max: -2   },
  { label: "Yesterday",         min: -1,        max: -1   },
  // Present + future groups
  { label: "Today",             min: 0,         max: 0    },
  { label: "Tomorrow",          min: 1,         max: 1    },
  { label: "This week",         min: 2,         max: 7    },
  { label: "This month",        min: 8,         max: 30   },
  { label: "Next 3 months",     min: 31,        max: 90   },
  { label: "Next 6 months",     min: 91,        max: 180  },
  { label: "Beyond 6 months",   min: 181,       max: Infinity },
];

// ── EventsTab ─────────────────────────────────────────────────

export default function EventsTab({
  clientId,
  initialEvents,
  initialEventTypes,
}: {
  clientId: string;
  initialEvents: TimelineEvent[];
  initialEventTypes: EventType[];
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [eventTypes, setEventTypes] = useState<EventType[]>(initialEventTypes);
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();
  const scrollTargetRef = useRef<HTMLDivElement>(null);

  const refreshEvents = useCallback(async () => {
    const data = await fetch(`/api/clients/${clientId}/events`).then((r) => r.json()).catch(() => null);
    if (Array.isArray(data)) setEvents(data);
    router.refresh();
  }, [clientId, router]);

  const scrollToToday = useCallback(() => {
    const el = scrollTargetRef.current;
    if (!el) return;
    // Find the overflow-y scroll container (like Gantt does with chartRef)
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent) {
      const style = getComputedStyle(scrollParent);
      if (style.overflowY === "auto" || style.overflowY === "scroll") break;
      scrollParent = scrollParent.parentElement;
    }
    if (scrollParent) {
      const elRect = el.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect();
      scrollParent.scrollTop += elRect.top - parentRect.top - 12;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshEvents().then(() => {
      // Double rAF: first waits for React commit, second for layout
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToToday();
        });
      });
    });
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((data: EventType[]) => { if (Array.isArray(data)) setEventTypes(data); })
      .catch(() => {});
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeConfig = buildTypeConfig(eventTypes);

  function openAddForm() {
    openPanel(
      "New Event",
      <EventForm
        clientId={clientId}
        eventTypes={eventTypes}
        onSaved={refreshEvents}
        onClose={closePanel}
      />
    );
  }

  function openEditForm(event: TimelineEvent) {
    openPanel(
      "Edit Event",
      <EventForm
        clientId={clientId}
        eventTypes={eventTypes}
        onSaved={refreshEvents}
        onClose={closePanel}
        editEvent={{
          id:                 event.sourceId,
          title:              event.title,
          date:               event.baseDate ?? event.date,
          type:               event.type,
          notes:              event.notes,
          recurrenceInterval: event.recurrenceInterval,
          recurrenceUnit:     event.recurrenceUnit,
          recurrence:         event.recurrence,
          repetitions:        event.repetitions,
        }}
      />
    );
  }

  async function handleDelete(event: TimelineEvent) {
    const res = await fetch(`/api/clients/${clientId}/events/${event.sourceId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      // Remove all occurrences of this event (same sourceId) from local state
      setEvents((prev) => prev.filter((e) => e.sourceId !== event.sourceId));
      router.refresh();
    }
  }

  const todayStr = today();

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border py-16 gap-3"
        style={{ borderColor: "var(--border)" }}
      >
        <CalendarDays size={32} strokeWidth={1.4} style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No events for this client.
        </p>
        <button
          type="button"
          onClick={openAddForm}
          className="px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
        >
          Add first event
        </button>
      </div>
    );
  }

  // One-off events go into the timeline groups; recurring events get a separate bucket.
  // Past recurring occurrences appear inline in past groups (no dedup).
  // Future recurring events are deduplicated to next occurrence only.
  const isRecurringEvent = (e: TimelineEvent) => !!(e.recurrenceInterval && e.recurrenceUnit);
  const oneOffEvents = events.filter((e) => !isRecurringEvent(e));

  const pastRecurringEvents = events.filter(
    (e) => isRecurringEvent(e) && daysBetween(todayStr, e.date) < 0
  );

  const recurringNext = new Map<string, TimelineEvent>();
  for (const e of events) {
    if (isRecurringEvent(e) && daysBetween(todayStr, e.date) >= 0 && !recurringNext.has(e.sourceId)) {
      recurringNext.set(e.sourceId, e);
    }
  }
  const recurringEvents = Array.from(recurringNext.values());

  // Timeline = one-off + past recurring occurrences + next future recurring occurrence
  const timelineEvents = [...oneOffEvents, ...pastRecurringEvents, ...recurringEvents];

  const activeGroups = GROUPS.map((group) => ({
    ...group,
    items: timelineEvents.filter((e) => {
      const d = daysBetween(todayStr, e.date);
      return d >= group.min && d <= group.max;
    }),
  })).filter((g) => g.items.length > 0);

  const hasTimeline = activeGroups.length > 0;
  const firstFutureIdx = activeGroups.findIndex((g) => g.min >= 0);

  return (
    <div className="space-y-10">
      {/* ── Timeline: one-off events ── */}
      {hasTimeline && (
        <div>
          <div className="space-y-7">
            {activeGroups.map((group, gi) => {
              const isPastGroup = group.max < 0;
              const isScrollTarget = gi === firstFutureIdx;
              return (
              <div
                key={group.label}
                className="relative"
                ref={isScrollTarget ? scrollTargetRef : undefined}
              >
                {/* Connector line from this dot down to the next dot */}
                {gi < activeGroups.length - 1 && (
                  <div
                    className="absolute w-px"
                    style={{
                      left: 4,
                      top: 5,
                      bottom: -33,
                      background: "var(--border)",
                    }}
                  />
                )}
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 border-2 z-10 relative"
                    style={{
                      background: isPastGroup
                        ? "var(--border)"
                        : gi === firstFutureIdx ? "var(--primary)" : "var(--bg-surface)",
                      borderColor: isPastGroup
                        ? "var(--border)"
                        : gi === firstFutureIdx ? "var(--primary)" : "var(--border)",
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide leading-tight"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {group.label}
                  </span>
                </div>
                <div className="pl-5 flex gap-3 flex-wrap">
                  {group.items.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onDelete={handleDelete}
                      onEdit={openEditForm}
                      clientId={clientId}
                      typeConfig={typeConfig}
                      isPast={isPastGroup}
                    />
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recurring events bucket ── */}
      {recurringEvents.length > 0 && (
        <div>
          {hasTimeline && (
            <div className="mb-5 h-px" style={{ background: "var(--border)" }} />
          )}
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={13} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Recurring
            </span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {recurringEvents.map((event) => (
              <EventCard
                key={event.sourceId}
                event={event}
                onDelete={handleDelete}
                onEdit={openEditForm}
                clientId={clientId}
                typeConfig={typeConfig}
                hideDate
              />
            ))}
          </div>
        </div>
      )}

      {/* Spacer so "Today" can always scroll to the top of the viewport */}
      {firstFutureIdx > 0 && <div className="min-h-[60vh]" />}
    </div>
  );
}
