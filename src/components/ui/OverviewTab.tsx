"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, X, ExternalLink, BookOpen, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, Contact, Log, LogSignal, Project, Service, Sheet } from "@/types";
import { fmtDate, timeAgoLabel } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import UserAvatar from "@/components/ui/UserAvatar";

const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysSinceISO(isoString: string): number {
  const past = new Date(isoString);
  const now = new Date();
  return Math.floor((now.getTime() - past.getTime()) / 86400000);
}

function activityTypeLabel(type: string): string {
  const map: Record<string, string> = {
    "log.created": "added a log",
    "log.updated": "updated a log",
    "log.deleted": "removed a log",
    "log.followedup": "marked a follow-up done",
    "task.created": "created a task",
    "task.completed": "completed a task",
    "task.deleted": "removed a task",
    "project.created": "created a project",
    "project.status_changed": "updated a project",
    "project.deleted": "removed a project",
    "contact.changed": "updated contacts",
    "client.updated": "updated company details",
  };
  return map[type] ?? "made a change";
}

function activityMetaSummary(type: string, metadata: Record<string, string>): string | null {
  if (type === "log.created" || type === "log.updated") return metadata.summary ?? null;
  if (type === "task.created" || type === "task.completed") return metadata.title ?? null;
  if (type === "project.created" || type === "project.status_changed") return metadata.title ?? null;
  return null;
}

function getRecentPeriodLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dateDay = new Date(date);
  dateDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - dateDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Last week";
  return "Last month";
}

interface ActivityEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorImage: string | null;
  type: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export default function OverviewTab({
  clientId,
  client,
  projects,
  initialLogs,
  signals,
  sheets,
  services,
  contacts,
  currentUserName,
  totalOpenTasks,
  overdueTaskCount,
  myOpenTasks,
  lastActivityAt,
  lastActivityActorName,
  lastActivityType,
}: {
  clientId: string;
  client: Client;
  projects: Project[];
  initialLogs: Log[];
  signals: LogSignal[];
  sheets: Sheet[];
  services: Service[];
  contacts: Contact[];
  currentUserName: string;
  currentUserId: string;
  isAdmin: boolean;
  totalOpenTasks: number;
  overdueTaskCount: number;
  myOpenTasks: number;
  lastActivityAt: string | null;
  lastActivityActorName: string | null;
  lastActivityType: string | null;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const router = useRouter();

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/activity?limit=5`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRecentActivity)
      .catch(() => {});
  }, [clientId]);

  // ── Derived ──────────────────────────────────────────────
  const openFollowUps = logs
    .filter((l) => l.followUp && l.followUpDeadline && !l.followedUpAt)
    .sort((a, b) => (a.followUpDeadline ?? "").localeCompare(b.followUpDeadline ?? ""));

  const activeProjects = projects.filter((p) => p.status !== "completed");

  // Group completed projects by service for the services table
  const serviceMap = new Map<string, { name: string; count: number; lastDate: string }>(
    services.map((s) => [s.id, { name: s.name, count: 0, lastDate: "" }])
  );
  for (const p of projects) {
    if (p.status === "completed" && p.serviceId && p.service) {
      const existing = serviceMap.get(p.serviceId);
      const date = p.completedDate ?? "";
      if (!existing) {
        serviceMap.set(p.serviceId, { name: p.service, count: 1, lastDate: date });
      } else {
        serviceMap.set(p.serviceId, {
          name: p.service,
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

  // ── Check-in timer ───────────────────────────────────────
  const WINDOW = 60;
  const daysElapsed = lastActivityAt ? daysSinceISO(lastActivityAt) : WINDOW;
  const daysRemaining = WINDOW - daysElapsed;
  const isOverdue = daysRemaining < 0;
  const fillPct = Math.max(0, Math.min(100, (daysRemaining / WINDOW) * 100));

  const timerColor =
    daysRemaining > 30 ? "#16a34a"
    : daysRemaining > 15 ? "#d97706"
    : daysRemaining > 5 ? "#ea580c"
    : "#dc2626";

  const timerLabel = !lastActivityAt
    ? "No activity recorded"
    : isOverdue
    ? `${Math.abs(daysRemaining)} days overdue`
    : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;

  // ── Recent activity grouped by period ───────────────────
  const recentActivityGroups = useMemo(() => {
    const map = new Map<string, { label: string; events: ActivityEvent[] }>();
    const order: string[] = [];
    for (const event of recentActivity.slice(0, 5)) {
      const label = getRecentPeriodLabel(event.createdAt);
      if (!map.has(label)) {
        map.set(label, { label, events: [] });
        order.push(label);
      }
      map.get(label)!.events.push(event);
    }
    return order.map((k) => map.get(k)!);
  }, [recentActivity]);

  // ── Inline log state ─────────────────────────────────────
  const [inline, setInline] = useState({
    summary: "",
    contactIds: [] as string[],
    signalIds: [] as string[],
    followUp: false,
    followUpDeadline: "",
  });
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState("");

  function resetInline() {
    setInline({ summary: "", contactIds: [], signalIds: [], followUp: false, followUpDeadline: "" });
    setInlineError("");
  }

  async function handleInlineSave() {
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
        followUpDeadline: inline.followUp ? inline.followUpDeadline || undefined : undefined,
      }),
    });
    setInlineSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setInlineError(d.error ?? "Failed to save");
      return;
    }
    const saved: Log = await res.json();
    saved.signals = saved.signalIds.map((id) => signals.find((s) => s.id === id)?.name ?? id);
    setLogs((prev) => [saved, ...prev]);
    resetInline();
    router.refresh();
  }

  return (
    <div className="space-y-6">

      {/* ── Client header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {client.company}
        </h1>
        {client.status && <StatusBadge status={client.status} />}
        {client.archetype && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {client.archetype}
          </span>
        )}
        {client.platform && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {client.platform === "summ_core" ? "SUMM Core" : "SUMM Suite"}
          </span>
        )}
      </div>

      {/* ── Top row: Projects | Sheets | Check-in timer ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Projects widget */}
        <div
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Projects
          </p>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {activeProjects.length}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>active</p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {totalOpenTasks} open task{totalOpenTasks === 1 ? "" : "s"}
              {overdueTaskCount > 0 && (
                <span style={{ color: "#dc2626" }}> · {overdueTaskCount} overdue</span>
              )}
            </p>
            {myOpenTasks > 0 && (
              <p className="text-xs" style={{ color: "var(--primary)" }}>
                {myOpenTasks} assigned to you
              </p>
            )}
          </div>
          <Link
            href={`/clients/${clientId}?tab=projects`}
            className="flex items-center gap-1 text-xs btn-link"
          >
            <FolderOpen size={11} />
            View projects
          </Link>
        </div>

        {/* Sheets widget */}
        <div
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Sheets
          </p>
          {sheets.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No sheets linked yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sheets.map((sheet) => (
                <a
                  key={sheet.id}
                  href={sheet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border text-sm font-medium transition-colors"
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
                  <ExternalLink size={14} className="shrink-0" />
                  <span className="truncate">{sheet.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Check-in timer */}
        <div
          className="rounded-xl border p-5 flex flex-col justify-between"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Check-in timer · 60 days
              </p>
              <p className="text-sm font-semibold" style={{ color: timerColor }}>
                {timerLabel}
              </p>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden mb-3"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${fillPct}%`, background: timerColor }}
              />
            </div>
          </div>
          {lastActivityAt && lastActivityActorName && lastActivityType ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Last:{" "}
              <span style={{ color: "var(--text-primary)" }}>
                {lastActivityActorName.trim().split(/\s+/)[0]}
              </span>{" "}
              {activityTypeLabel(lastActivityType)}
              {" · "}
              {timeAgoLabel(daysElapsed)}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No activity has been recorded yet.
            </p>
          )}
        </div>

      </div>

      {/* ── Main row: Logbook timeline | Recent activity ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* LEFT: Timeline — log form + follow-ups */}
        <div>

          {/* Log form as a timeline entry */}
          <div className="relative" style={{ marginBottom: openFollowUps.length > 0 ? "32px" : "0" }}>
            {/* Connector line going down to first follow-up */}
            {openFollowUps.length > 0 && (
              <div
                className="absolute w-px"
                style={{ left: "17px", top: "8px", bottom: "-40px", background: "var(--primary)", opacity: 0.2, zIndex: 0 }}
              />
            )}
            {/* Dot + today label */}
            <div className="relative z-20 flex items-center gap-2.5 mb-2 pl-3">
              <div
                className="w-3 h-3 rounded-full flex-none relative z-10 bg-white dark:bg-[var(--bg-sidebar)]"
                style={{ border: "1.5px dotted var(--primary)" }}
              />
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {fmtDate(today())}
                <span className="mx-1.5">·</span>
                {currentUserName}
              </p>
            </div>
            {/* Form card */}
            <div
              className="relative rounded-xl border bg-white dark:bg-[var(--bg-sidebar)]"
              style={{
                borderColor: "var(--primary)",
                boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04), 0 0 28px 4px color-mix(in srgb, var(--primary) 12%, transparent)",
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
                      <label className={labelClass} style={labelStyle}>Contact person</label>
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
                      <label className={labelClass} style={labelStyle}>Signals</label>
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
                    <label className={labelClass} style={labelStyle}>Follow-up needed?</label>
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
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                            width: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {inlineError && <p className="text-xs text-red-500">{inlineError}</p>}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!inline.summary.trim() || inlineSaving}
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

          {/* Follow-up entries as timeline */}
          {openFollowUps.length === 0 ? (
            <p className="text-xs pl-8 mt-2" style={{ color: "var(--text-muted)" }}>
              No open follow-ups.
            </p>
          ) : (
            <>
              {openFollowUps.slice(0, 5).map((log, idx) => {
                const isLast = idx === Math.min(openFollowUps.length, 5) - 1;
                const overdue = log.followUpDeadline! < today();
                const dotColor = overdue ? "#dc2626" : "var(--primary)";
                return (
                  <div key={log.id} className="relative" style={{ marginBottom: isLast ? 0 : "24px" }}>
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className="absolute w-px"
                        style={{ left: "17px", top: "8px", bottom: "-32px", background: "var(--primary)", opacity: 0.2, zIndex: 0 }}
                      />
                    )}
                    {/* Dot + date/name row */}
                    <div className="flex items-center gap-2.5 mb-2 pl-3">
                      <div
                        className="w-3 h-3 rounded-full flex-none relative z-10"
                        style={{ background: dotColor }}
                      />
                      <p className="text-xs font-medium flex-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                        <span>{fmtDate(log.date)}</span>
                        <span>·</span>
                        <span>{log.createdByName}</span>
                        <span
                          className="ml-auto font-medium"
                          style={{ color: overdue ? "#dc2626" : "var(--primary)" }}
                        >
                          {overdue ? "Overdue · " : "Due "}{fmtDate(log.followUpDeadline)}
                        </span>
                      </p>
                    </div>
                    {/* Entry card — positioned above connector lines */}
                    <div
                      className="relative rounded-xl border p-4 bg-white dark:bg-[var(--bg-sidebar)]"
                      style={{
                        borderColor: overdue ? "#fca5a5" : "var(--border)",
                        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
                        zIndex: 1,
                      }}
                    >
                      <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "var(--text-primary)" }}>
                        {log.summary}
                      </p>
                    </div>
                  </div>
                );
              })}

              {openFollowUps.length > 5 && (
                <p className="text-xs mt-3 pl-8" style={{ color: "var(--text-muted)" }}>
                  +{openFollowUps.length - 5} more
                </p>
              )}

              <Link
                href={`/clients/${clientId}?tab=logbook`}
                className="flex items-center gap-1 text-xs btn-link mt-4"
              >
                <BookOpen size={11} />
                View logbook
              </Link>
            </>
          )}
        </div>

        {/* RIGHT: Recent activity with period headers */}
        <div
          className="rounded-xl border p-4 flex flex-col gap-3 self-start"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Recent activity
          </p>
          {recentActivity.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentActivityGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                    {group.label}
                  </p>
                  <div className="space-y-3">
                    {group.events.map((event) => {
                      const meta = activityMetaSummary(event.type, event.metadata);
                      return (
                        <div key={event.id} className="flex items-start gap-3">
                          <UserAvatar
                            name={event.actorName}
                            image={event.actorImage ?? undefined}
                            size={24}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                              <span className="font-medium">
                                {event.actorName.trim().split(/\s+/)[0]}
                              </span>
                              {" "}
                              <span style={{ color: "var(--text-muted)" }}>
                                {activityTypeLabel(event.type)}
                              </span>
                            </p>
                            {meta && (
                              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                                {meta}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href={`/clients/${clientId}?tab=activity`}
            className="flex items-center gap-1 text-xs btn-link"
          >
            View all activity
          </Link>
        </div>

      </div>

      {/* ── Services delivered table ── */}
      {services.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 grid grid-cols-3 text-xs font-semibold uppercase tracking-wide"
            style={{
              background: "var(--bg-surface)",
              borderBottom: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <span>Service</span>
            <span className="text-center">Delivered</span>
            <span className="text-right">Last completed</span>
          </div>
          {deliveredServiceRows.map((row, idx) => (
            <div
              key={row.name}
              className="px-4 py-3 grid grid-cols-3 items-center"
              style={{
                borderBottom: idx < deliveredServiceRows.length - 1 ? "1px solid var(--border)" : undefined,
                background: idx % 2 === 1 ? "var(--bg-surface)" : undefined,
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
