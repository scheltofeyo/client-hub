"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, X, FileText, BookOpen, FolderOpen, Users, FolderPlus, CheckSquare, CalendarPlus, CalendarDays, FilePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, ClientStatusOption, Contact, EventType, LogSignal, Project, Service, Sheet, Task, TimelineEvent } from "@/types";
import { fmtDate } from "@/lib/utils";
import { accentColor } from "@/lib/styles";
import StatusBadge from "@/components/ui/StatusBadge";
import UserAvatar from "@/components/ui/UserAvatar";
import { useRightPanel } from "@/components/layout/RightPanel";
import { AddProjectModal } from "@/components/ui/AddProjectButton";
import { CollapsibleTypeGroup, ActivityEvent, getPeriodKey, getPeriodLabel } from "@/components/ui/ActivityTab";
import { TaskForm } from "@/components/ui/ClientTasksTab";
import { EventForm } from "@/components/ui/EventsTab";
import { SheetManagerPanel } from "@/components/ui/SheetsTab";


function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysSinceISO(isoString: string): number {
  const past = new Date(isoString);
  const now = new Date();
  return Math.floor((now.getTime() - past.getTime()) / 86400000);
}

function addDaysToISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + days).toISOString().slice(0, 10);
}

function daysUntilISO(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function expiryColor(daysUntil: number): string {
  if (daysUntil > 14) return "var(--text-muted)";
  if (daysUntil > 7)  return "#d97706";
  if (daysUntil >= 0) return "#ea580c";
  return "#dc2626";
}




const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function daysBetweenStrings(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000);
}

function relativeLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "In 1 week";
  if (days < 31) return `In ${Math.round(days / 7)} weeks`;
  return `In ~${Math.round(days / 30)} month${Math.round(days / 30) !== 1 ? "s" : ""}`;
}

// ── Monogram helpers (matches /clients card style) ──────────────────────
function monogramInitials(company: string): string {
  return company.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function UpcomingEventCard({ event, eventTypes, clientId }: { event: TimelineEvent; eventTypes: EventType[]; clientId: string }) {
  const et = eventTypes.find((e) => e.slug === event.type);
  const color =
    event.type === "follow_up" ? "#3b82f6" :
    event.type === "project_completion" ? "var(--primary)" :
    event.type === "deadline" ? "#ef4444" :
    event.type === "delivery" ? "#10b981" :
    et?.color ?? "var(--text-muted)";
  const label =
    event.type === "follow_up" ? "Follow-up" :
    event.type === "project_completion" ? "Project" :
    event.type === "deadline" ? "Deadline" :
    event.type === "delivery" ? "Delivery" :
    et?.label ?? event.type;

  const [, mm, dd] = event.date.split("-");
  const monthStr = MONTHS[parseInt(mm) - 1];
  const dayStr = parseInt(dd).toString();
  const days = daysBetweenStrings(today(), event.date);

  const href =
    event.source === "log_followup" ? `/clients/${clientId}?tab=logbook` :
    event.source === "task" ? `/clients/${clientId}?tab=tasks` :
    event.source === "project" ? `/clients/${clientId}?tab=projects` :
    `/clients/${clientId}?tab=events`;

  return (
    <Link
      href={href}
      className="flex rounded-xl border overflow-hidden flex-1 min-w-0 transition-opacity hover:opacity-80"
      style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
    >
      {/* Date block */}
      <div
        className="flex flex-col items-center justify-center shrink-0 px-3 py-3 gap-0.5"
        style={{
          width: 60,
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
      {/* Content */}
      <div className="flex flex-col flex-1 min-w-0 px-3 py-2.5 gap-0.5">
        <span className="typo-tag" style={{ color }}>
          {label}
        </span>
        <p className="typo-card-title leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {event.title}
        </p>
        <p className="text-xs mt-auto pt-1" style={{ color: "var(--text-muted)" }}>
          {relativeLabel(days)}
        </p>
      </div>
    </Link>
  );
}

export default function OverviewTab({
  clientId,
  client,
  projects,
  signals,
  sheets,
  services,
  contacts,
  initialEvents,
  eventTypes,
  statusOptions = [],
  lastActivityAt,
  serviceFollowUpDates = {},
}: {
  clientId: string;
  client: Client;
  projects: Project[];
  signals: LogSignal[];
  sheets: Sheet[];
  services: Service[];
  contacts: Contact[];
  currentUserId: string;
  isAdmin: boolean;
  totalOpenTasks: number;
  overdueTaskCount: number;
  myOpenTasks: number;
  initialEvents: TimelineEvent[];
  eventTypes: EventType[];
  statusOptions?: ClientStatusOption[];
  lastActivityAt: string | null;
  serviceFollowUpDates?: Record<string, string>;
}) {
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string; image: string | null }[]>([]);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  // ── Check-in timer ───────────────────────────────────────
  const statusCheckInDays = client.status
    ? statusOptions.find((s) => s.slug === client.status)?.checkInDays ?? null
    : null;
  const WINDOW = statusCheckInDays ?? 60;
  const daysElapsed = lastActivityAt ? daysSinceISO(lastActivityAt) : WINDOW;
  const daysRemaining = WINDOW - daysElapsed;
  const isOverdue = daysRemaining < 0;

  useEffect(() => {
    fetch(`/api/clients/${clientId}/activity?limit=50`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRecentActivity)
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => r.ok ? r.json() : [])
      .then(setAssignableUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOverdue) return;
    (async () => {
      const res = await fetch(`/api/clients/${clientId}/tasks`);
      if (!res.ok) return;
      const tasks: Task[] = await res.json();
      const taskTitle = `Check in with ${client.company}`;
      const alreadyExists = tasks.some(
        (t) => !t.completedAt && t.title.toLowerCase() === taskTitle.toLowerCase()
      );
      if (alreadyExists) return;
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 14);
      const completionDate = deadline.toISOString().split("T")[0];
      await fetch(`/api/clients/${clientId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, completionDate }),
      });
    })();
  }, [clientId, isOverdue]);

  // ── Derived ──────────────────────────────────────────────

  // Group completed projects by service for the services table
  const serviceMap = new Map<string, { id: string; name: string; count: number; lastDate: string; checkInDays: number | null }>(
    services.map((s) => [s.id, { id: s.id, name: s.name, count: 0, lastDate: "", checkInDays: s.checkInDays ?? null }])
  );
  for (const p of projects) {
    if (p.status === "completed" && p.serviceId && p.service) {
      const existing = serviceMap.get(p.serviceId);
      const date = p.completedDate ?? "";
      if (!existing) {
        serviceMap.set(p.serviceId, { id: p.serviceId, name: p.service, count: 1, lastDate: date, checkInDays: null });
      } else {
        serviceMap.set(p.serviceId, {
          ...existing,
          count: existing.count + 1,
          lastDate: date > existing.lastDate ? date : existing.lastDate,
        });
      }
    }
  }
  const deliveredServiceRows = [...serviceMap.values()].sort((a, b) => {
    if (b.lastDate !== a.lastDate) return b.lastDate.localeCompare(a.lastDate);
    return a.name.localeCompare(b.name);
  });

  // ── Check-in timer (continued) ───────────────────────────
  const fillPct = Math.max(0, Math.min(100, (daysRemaining / WINDOW) * 100));

  const timerColor =
    daysRemaining > WINDOW * 0.5 ? "color-mix(in srgb, var(--primary) 75%, transparent)"
    : daysRemaining > WINDOW * 0.25 ? "#d97706bf"
    : daysRemaining > WINDOW * 0.08 ? "#ea580cbf"
    : "#dc2626bf";

  const timerLabel = !lastActivityAt
    ? "No activity recorded"
    : isOverdue
    ? `${Math.abs(daysRemaining)} days overdue`
    : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;

  // ── Recent activity grouped by period → type ─────────────
  const recentActivityGroups = useMemo(() => {
    const now = new Date();
    const periodMap = new Map<string, { label: string; typeMap: Map<string, ActivityEvent[]> }>();
    const periodOrder: string[] = [];
    for (const event of recentActivity) {
      const key = getPeriodKey(event.createdAt, now);
      const label = getPeriodLabel(event.createdAt, now);
      if (!periodMap.has(key)) {
        periodMap.set(key, { label, typeMap: new Map() });
        periodOrder.push(key);
      }
      const period = periodMap.get(key)!;
      if (!period.typeMap.has(event.type)) period.typeMap.set(event.type, []);
      period.typeMap.get(event.type)!.push(event);
    }

    // Flatten to ordered list of type groups, take first 5, then re-group by period
    const flat: { key: string; label: string; type: string; events: ActivityEvent[] }[] = [];
    for (const key of periodOrder) {
      const { label, typeMap } = periodMap.get(key)!;
      for (const [type, events] of typeMap) {
        flat.push({ key, label, type, events });
      }
    }
    const top5 = flat.slice(0, 5);

    const result = new Map<string, { label: string; typeGroups: { type: string; events: ActivityEvent[] }[] }>();
    const resultOrder: string[] = [];
    for (const row of top5) {
      if (!result.has(row.key)) {
        result.set(row.key, { label: row.label, typeGroups: [] });
        resultOrder.push(row.key);
      }
      result.get(row.key)!.typeGroups.push({ type: row.type, events: row.events });
    }
    return resultOrder.map((k) => result.get(k)!);
  }, [recentActivity]);

  // ── Inline log state ─────────────────────────────────────
  const [inline, setInline] = useState({
    summary: "",
    contactIds: [] as string[],
    signalIds: [] as string[],
    followUp: false,
    followUpAction: "",
    followUpDeadline: "",
  });
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState("");

  function resetInline() {
    setInline({ summary: "", contactIds: [], signalIds: [], followUp: false, followUpAction: "", followUpDeadline: "" });
    setInlineError("");
  }

  async function handleInlineSave() {
    if (inline.followUp && !inline.followUpAction.trim()) {
      setInlineError("A follow-up action is required when follow-up is enabled.");
      return;
    }
    if (inline.followUp && !inline.followUpDeadline) {
      setInlineError("A follow-up date is required when follow-up is enabled.");
      return;
    }
    setInlineSaving(true);
    setInlineError("");
    const res = await fetch(`/api/clients/${clientId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: today(),
        summary: inline.summary,
        contactIds: inline.contactIds,
        signalIds: inline.signalIds,
        followUp: inline.followUp,
        followUpAction: inline.followUp ? inline.followUpAction || undefined : undefined,
        followUpDeadline: inline.followUp ? inline.followUpDeadline || undefined : undefined,
      }),
    });
    setInlineSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setInlineError(d.error ?? "Failed to save");
      return;
    }
    resetInline();
    router.refresh();
  }

  const cardColor = accentColor(client.company);
  const abbr = monogramInitials(client.company);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Two-column split ── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT: Static client info (1/3) ── */}
        <div
          className="w-1/3 flex-none rounded-xl border flex flex-col sticky top-6 overflow-hidden bg-white dark:bg-[var(--bg-sidebar)]"
          style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
        >
          {/* Tinted header with monogram + chips */}
          <div
            className="relative flex items-start px-5 pt-5 shrink-0"
            style={{ background: `color-mix(in srgb, ${cardColor} 8%, transparent)`, height: "52px" }}
          >
            {/* Status + platform chips — top right */}
            {(client.status || client.platform) && (
              <div className="absolute top-3.5 right-4 flex items-center gap-1.5">
                {client.platform && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-elevated)" }}
                  >
                    {client.platformLabel ?? client.platform}
                  </span>
                )}
                {client.status && <StatusBadge status={client.status} />}
              </div>
            )}
            {/* Monogram avatar — hangs below header */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-sm flex-none relative"
              style={{ background: cardColor, marginBottom: "-24px", zIndex: 10 }}
            >
              {abbr}
            </div>
          </div>

          {/* Card body */}
          <div className="flex flex-col gap-4 px-5 pt-9 pb-5">
            {/* Company name + description + employees + chips */}
            <div className="flex flex-col gap-2">
              <h1 className="typo-modal-title leading-tight" style={{ color: "var(--text-primary)" }}>
                {client.company}
              </h1>
              {client.description && (
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {client.description}
                </p>
              )}
              {client.employees && (
                <div className="flex items-center gap-2">
                  <Users size={13} style={{ color: "var(--text-muted)" }} className="flex-none" />
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {client.employees} employees
                  </span>
                </div>
              )}
              {client.archetype && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    {client.archetype}
                  </span>
                </div>
              )}
            </div>

            <hr style={{ borderColor: "var(--border)" }} />

            {/* Client leads */}
            <div className="flex flex-col gap-2">
              <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                Client leads
              </p>
              {client.leads && client.leads.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {client.leads.map((lead) => (
                    <div key={lead.userId} className="flex items-center gap-2">
                      <UserAvatar name={lead.name} image={lead.image} size={24} />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {lead.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No leads assigned.</p>
              )}
            </div>

            {/* Sheets */}
            <div className="flex flex-col gap-2">
              <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                Sheets
              </p>
              {sheets.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No sheets linked yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sheets.map((sheet) => (
                    <Link
                      key={sheet.id}
                      href={`/clients/${clientId}/sheets/${sheet.id}`}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                        background: "var(--bg-sidebar)",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.style.borderColor = "var(--primary)";
                        el.style.color = "var(--primary)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        el.style.borderColor = "var(--border)";
                        el.style.color = "var(--text-primary)";
                      }}
                    >
                      <FileText size={13} className="shrink-0" />
                      <span className="truncate">{sheet.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Operational content (2/3) ── */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 pt-[24px] @container">

          {/* Quick actions */}
          <div className="grid grid-cols-2 @[421px]:grid-cols-4 gap-3">
            <button
              type="button"
              className="btn-action"
              onClick={() => setAddProjectOpen(true)}
            >
              <FolderPlus size={18} />
              New project
            </button>
            <AddProjectModal clientId={clientId} open={addProjectOpen} onClose={() => setAddProjectOpen(false)} />
            <button
              type="button"
              className="btn-action"
              onClick={() =>
                openPanel("New Task", (
                  <TaskForm
                    clientId={clientId}
                    users={assignableUsers}
                    onSaved={(_task: Task) => { router.refresh(); closePanel(); }}
                    onClose={closePanel}
                  />
                ))
              }
            >
              <CheckSquare size={18} />
              New task
            </button>
            <button
              type="button"
              className="btn-action"
              onClick={() =>
                openPanel("New Event", (
                  <EventForm
                    clientId={clientId}
                    eventTypes={eventTypes}
                    onSaved={() => router.refresh()}
                    onClose={closePanel}
                  />
                ))
              }
            >
              <CalendarPlus size={18} />
              New event
            </button>
            <button
              type="button"
              className="btn-action"
              onClick={() =>
                openPanel("Manage Sheets", (
                  <SheetManagerPanel
                    clientId={clientId}
                    initialSheets={sheets}
                  />
                ))
              }
            >
              <FilePlus size={18} />
              New sheet
            </button>
          </div>

          {/* Log form + follow-ups timeline */}
          <div
            className="rounded-xl border p-4 bg-white dark:bg-[var(--bg-sidebar)]"
            style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
          >

            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Logbook</h2>
              <Link
                href={`/clients/${clientId}?tab=logbook`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
              >
                <BookOpen size={13} />
                View logbook
              </Link>
            </div>

            {/* Form card */}
              <div
                className="relative rounded-xl border bg-white dark:bg-[var(--bg-sidebar)]"
                style={{
                  borderColor: "var(--primary)",
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
                  padding: "1rem",
                  zIndex: 1,
                }}
              >
                <textarea
                  placeholder="Log something for this client…"
                  value={inline.summary}
                  onChange={(e) => setInline((f) => ({ ...f, summary: e.target.value }))}
                  rows={3}
                  className="w-full text-sm leading-relaxed resize-none bg-transparent outline-none placeholder:text-[var(--text-muted)]"
                  style={{ color: "var(--text-primary)" }}
                />

                {inline.summary && (
                  <div className="mt-3 flex flex-col gap-3">
                    {contacts.length > 0 && (
                      <div>
                        <label className="typo-label">Contact person</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {contacts.map((c) => {
                            const active = inline.contactIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() =>
                                  setInline((f) => ({
                                    ...f,
                                    contactIds: active
                                      ? f.contactIds.filter((id) => id !== c.id)
                                      : [...f.contactIds, c.id],
                                  }))
                                }
                                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                                style={{
                                  borderColor: active ? "var(--primary)" : "var(--border)",
                                  background: active ? "var(--primary)" : "transparent",
                                  color: active ? "#fff" : "var(--text-muted)",
                                }}
                              >
                                {c.firstName} {c.lastName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {signals.length > 0 && (
                      <div>
                        <label className="typo-label">Signals</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {signals.map((s) => {
                            const active = inline.signalIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() =>
                                  setInline((f) => ({
                                    ...f,
                                    signalIds: active
                                      ? f.signalIds.filter((id) => id !== s.id)
                                      : [...f.signalIds, s.id],
                                  }))
                                }
                                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                                style={{
                                  borderColor: active ? "var(--primary)" : "var(--border)",
                                  background: active ? "var(--primary)" : "transparent",
                                  color: active ? "#fff" : "var(--text-muted)",
                                }}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="typo-label">Follow-up needed?</label>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setInline((f) => ({ ...f, followUp: !f.followUp }))}
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                          style={{ background: inline.followUp ? "var(--primary)" : "var(--border)" }}
                          role="switch"
                          aria-checked={inline.followUp}
                        >
                          <span
                            className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: inline.followUp ? "translateX(16px)" : "translateX(0)" }}
                          />
                        </button>
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {inline.followUp ? "Yes" : "No"}
                        </span>
                        {inline.followUp && (
                          <input
                            type="date"
                            value={inline.followUpDeadline}
                            onChange={(e) =>
                              setInline((f) => ({ ...f, followUpDeadline: e.target.value }))
                            }
                            className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                            style={{
                              background: "var(--bg-sidebar)",
                              borderColor: inline.followUpDeadline ? "var(--border)" : "#f87171",
                              color: "var(--text-primary)",
                              width: "auto",
                            }}
                          />
                        )}
                      </div>
                      {inline.followUp && (
                        <div className="mt-2">
                          <label className="typo-label">
                            Action to follow up on <span className="text-[var(--danger)]">*</span>
                          </label>
                          <input
                            type="text"
                            value={inline.followUpAction}
                            onChange={(e) => setInline((f) => ({ ...f, followUpAction: e.target.value }))}
                            placeholder="What needs to be done…"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                            style={{
                              background: "var(--bg-sidebar)",
                              borderColor: inline.followUpAction ? "var(--border)" : "#f87171",
                              color: "var(--text-primary)",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {inlineError && <p className="text-xs text-[var(--danger)]">{inlineError}</p>}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={!inline.summary.trim() || (inline.followUp && (!inline.followUpAction.trim() || !inline.followUpDeadline)) || inlineSaving}
                        onClick={handleInlineSave}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
                      >
                        <Check size={13} />
                        {inlineSaving ? "Saving…" : "Add log"}
                      </button>
                      <button
                        type="button"
                        onClick={resetInline}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm btn-ghost"
                      >
                        <X size={13} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* Upcoming events */}
          {(() => {
            const seen = new Set<string>();
            const deduped = initialEvents.filter((e) => {
              const isRecurring = !!(e.recurrenceInterval && e.recurrenceUnit);
              if (!isRecurring) return true;
              if (seen.has(e.sourceId)) return false;
              seen.add(e.sourceId);
              return true;
            });
            return (
              <div
                className="rounded-xl border p-4 flex flex-col gap-4 bg-white dark:bg-[var(--bg-sidebar)]"
                style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Upcoming events</h2>
                  <Link
                    href={`/clients/${clientId}?tab=events`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
                  >
                    <CalendarDays size={13} />
                    View all events
                  </Link>
                </div>
                {deduped.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No upcoming events for this client.</p>
                ) : (
                  <div className="flex gap-3">
                    {deduped.slice(0, 2).map((event) => (
                      <UpcomingEventCard key={event.id} event={event} eventTypes={eventTypes} clientId={clientId} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Recent activity */}
          <div
            className="rounded-xl border p-4 flex flex-col gap-3 bg-white dark:bg-[var(--bg-sidebar)]"
            style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Recent activity</h2>
              <Link
                href={`/clients/${clientId}?tab=activity`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
              >
                <FolderOpen size={13} />
                View all activity
              </Link>
            </div>

            {/* Check-in timer — only show when ≤ 50% remaining or overdue */}
            {(isOverdue || daysRemaining <= WINDOW / 2) && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                    No activity for {daysElapsed} day{daysElapsed === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: timerColor }}>
                    {timerLabel}
                  </p>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${fillPct}%`, background: timerColor }}
                  />
                </div>
              </div>
            )}

            {(isOverdue || daysRemaining <= WINDOW / 2) && (
              <hr style={{ borderColor: "var(--border)" }} />
            )}

            {recentActivity.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity yet.</p>
            ) : (
              <div className="space-y-4">
                {recentActivityGroups.map((group) => (
                  <div key={group.label}>
                    <p className="typo-section-header mb-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      {group.label}
                    </p>
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {group.typeGroups.map(({ type, events }) => (
                        <CollapsibleTypeGroup key={type} type={type} events={events} clientId={clientId} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Services delivered table (full width) ── */}
      {services.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden bg-white dark:bg-[var(--bg-sidebar)]"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="px-4 py-3 grid grid-cols-4 typo-section-header bg-white dark:bg-[var(--bg-sidebar)]"
            style={{
              borderBottom: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <span>Service</span>
            <span className="text-center">Delivered</span>
            <span className="text-right">Last completed</span>
            <span className="text-right">Check-in due</span>
          </div>
          {deliveredServiceRows.map((row, idx) => {
            const followUpDate = serviceFollowUpDates[row.id];
            const anchorDate = followUpDate && followUpDate > row.lastDate ? followUpDate : row.lastDate;
            const expiryDate = row.checkInDays && anchorDate
              ? addDaysToISO(anchorDate, row.checkInDays)
              : null;
            const daysUntil = expiryDate ? daysUntilISO(expiryDate) : null;
            const color = daysUntil != null ? expiryColor(daysUntil) : "var(--text-muted)";
            return (
              <div
                key={row.name}
                className="px-4 py-3 grid grid-cols-4 items-center"
                style={{
                  borderBottom: idx < deliveredServiceRows.length - 1 ? "1px solid var(--border)" : undefined,
                  background: "var(--bg-surface)",
                }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {row.name}
                </span>
                <span
                  className="text-sm text-center tabular-nums"
                  style={{ color: row.count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {row.count}×
                </span>
                <span className="text-sm text-right" style={{ color: "var(--text-muted)" }}>
                  {row.lastDate ? fmtDate(row.lastDate) : "—"}
                </span>
                <span className="text-sm text-right tabular-nums" style={{ color }}>
                  {expiryDate
                    ? daysUntil != null && daysUntil < 0
                      ? `${fmtDate(expiryDate)} (overdue)`
                      : fmtDate(expiryDate)
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
