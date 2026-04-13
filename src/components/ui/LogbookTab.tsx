"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, ChevronDown, MoreHorizontal, Pencil, Trash2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Contact, Log, LogSignal } from "@/types";
import { fmtDate, daysAgo, timeAgoLabel } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function LogbookStats({
  logs,
  signals,
  sortedLogs,
}: {
  logs: Log[];
  signals: LogSignal[];
  sortedLogs: Log[];
}) {
  if (logs.length === 0) return null;

  const openFollowUps = logs.filter(
    (l) => l.followUp && l.followUpDeadline && !l.followedUpAt
  ).length;

  const overdueFollowUps = logs.filter(
    (l) => l.followUp && l.followUpDeadline && !l.followedUpAt && l.followUpDeadline < today()
  ).length;

  const latestDaysAgo = daysAgo(sortedLogs[0].date);
  const latestIsStale = latestDaysAgo > 90;

  const signalCounts = new Map(signals.map((s) => [s.id, 0]));
  for (const log of logs) {
    for (const id of log.signalIds) {
      signalCounts.set(id, (signalCounts.get(id) ?? 0) + 1);
    }
  }
  const topSignals = [...signals]
    .sort((a, b) => {
      const diff = (signalCounts.get(b.id) ?? 0) - (signalCounts.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.rank - b.rank;
    })
    .slice(0, 3);

  return (
    <div className="grid grid-cols-3 gap-4 max-w-2xl mb-7">
      {/* Latest log */}
      <div className="rounded-xl border p-4 space-y-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Latest log</p>
        <p className="typo-metric" style={{ color: latestIsStale ? "var(--danger)" : "var(--text-primary)" }}>{timeAgoLabel(latestDaysAgo)}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(sortedLogs[0].date)}</p>
      </div>

      {/* Open follow-ups */}
      <div className="rounded-xl border p-4 space-y-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Open follow-ups</p>
        <p className="typo-metric" style={{ color: "var(--text-primary)" }}>
          {openFollowUps}
        </p>
        {overdueFollowUps > 0 && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>{overdueFollowUps} overdue</p>
        )}
      </div>

      {/* Top signals */}
      <div className="rounded-xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Top signals</p>
        {signals.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No signals configured.</p>
        ) : (
          <div className="space-y-1.5">
            {topSignals.map((s) => {
              const count = signalCounts.get(s.id) ?? 0;
              return (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                  <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function LogForm({
  clientId,
  clientName,
  contacts,
  signals,
  currentUserName,
  initial,
  onSaved,
  onClose,
}: {
  clientId: string;
  clientName: string;
  contacts: Contact[];
  signals: LogSignal[];
  currentUserName: string;
  initial?: Log;
  onSaved: (log: Log) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    contactIds: initial?.contactIds ?? ([] as string[]),
    date: initial?.date ?? today(),
    summary: initial?.summary ?? "",
    signalIds: initial?.signalIds ?? ([] as string[]),
    followUp: initial?.followUp ?? false,
    followUpAction: initial?.followUpAction ?? "",
    followUpDeadline: initial?.followUpDeadline ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function toggleContact(id: string) {
    setForm((f) => ({
      ...f,
      contactIds: f.contactIds.includes(id) ? f.contactIds.filter((c) => c !== id) : [...f.contactIds, id],
    }));
  }

  function toggleSignal(id: string) {
    setForm((f) => ({
      ...f,
      signalIds: f.signalIds.includes(id)
        ? f.signalIds.filter((s) => s !== id)
        : [...f.signalIds, id],
    }));
  }

  async function handleSubmit() {
    if (form.followUp && !form.followUpAction.trim()) {
      setError("A follow-up action is required when follow-up is enabled.");
      return;
    }
    if (form.followUp && !form.followUpDeadline) {
      setError("A follow-up date is required when follow-up is enabled.");
      return;
    }
    setSaving(true);
    setError("");

    const url = initial
      ? `/api/clients/${clientId}/logs/${initial.id}`
      : `/api/clients/${clientId}/logs`;
    const method = initial ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: form.contactIds,
        date: form.date,
        summary: form.summary,
        signalIds: form.signalIds,
        followUp: form.followUp,
        followUpAction: form.followUp ? form.followUpAction || undefined : undefined,
        followUpDeadline: form.followUp ? form.followUpDeadline || undefined : undefined,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to save log");
      return;
    }

    const saved: Log = await res.json();
    saved.signals = saved.signalIds.map(
      (id) => signals.find((s) => s.id === id)?.name ?? id
    );
    onSaved(saved);
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <div>
        <label className="typo-label">
          Summary <span className="text-[var(--danger)]">*</span>
        </label>
        <textarea
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          rows={4}
          placeholder="What was discussed…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      {contacts.length > 0 && (
        <div>
          <label className="typo-label">{clientName} contacts</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {contacts.map((c) => {
              const active = form.contactIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(c.id)}
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
              const active = form.signalIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSignal(s.id)}
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
            onClick={() => setForm((f) => ({ ...f, followUp: !f.followUp }))}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
            style={{ background: form.followUp ? "var(--primary)" : "var(--border)" }}
            role="switch"
            aria-checked={form.followUp}
          >
            <span
              className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: form.followUp ? "translateX(16px)" : "translateX(0)" }}
            />
          </button>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {form.followUp ? "Yes" : "No"}
          </span>
          {form.followUp && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={form.followUpDeadline}
                onChange={(e) => setForm((f) => ({ ...f, followUpDeadline: e.target.value }))}
                className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                style={{ background: "var(--bg-sidebar)", borderColor: form.followUpDeadline ? "var(--border)" : "var(--danger)", color: "var(--text-primary)", width: "auto" }}
                required
              />
              <span className="text-[var(--danger)] text-xs">*</span>
            </div>
          )}
        </div>
        {form.followUp && (
          <div className="mt-2">
            <label className="typo-label">
              Action to follow up on <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={form.followUpAction}
              onChange={(e) => setForm((f) => ({ ...f, followUpAction: e.target.value }))}
              placeholder="What needs to be done…"
              className={inputClass}
              style={{ ...inputStyle, borderColor: form.followUpAction ? "var(--border)" : "var(--danger)" }}
            />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-6">
        <div>
          <label className="typo-label">Logged by</label>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            {initial?.createdByName ?? currentUserName}
          </p>
        </div>
        <div>
          <label className="typo-label">Date <span className="text-[var(--danger)]">*</span></label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)", color: "var(--text-primary)", width: "auto" }}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !form.date.trim() || !form.summary.trim() || (form.followUp && (!form.followUpAction.trim() || !form.followUpDeadline))}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : initial ? "Save changes" : "Add log"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm btn-ghost"
        >
          <X size={13} />
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LogCardMenu({
  canEdit,
  canDelete,
  hasFollowUp,
  alreadyFollowedUp,
  onFollowUp,
  onUndoFollowUp,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  hasFollowUp: boolean;
  alreadyFollowedUp: boolean;
  onFollowUp: () => void;
  onUndoFollowUp: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hide menu entirely when there are no actions
  if (!canEdit && !canDelete && !hasFollowUp) return null;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md btn-icon"
        title="Options"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[210px] rounded-lg border py-1 shadow-md"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          {/* Mark as followed up / Undo — only shown when follow-up is set */}
          {hasFollowUp && (
            <button
              type="button"
              onClick={() => { setOpen(false); if (alreadyFollowedUp) { onUndoFollowUp(); } else { onFollowUp(); } }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sidebar)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {alreadyFollowedUp ? <X size={13} /> : <Check size={13} />}
              {alreadyFollowedUp ? "Undo follow-up" : "Mark as followed up"}
            </button>
          )}

          {canEdit && (
              <button
                type="button"
                onClick={() => { setOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sidebar)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <Pencil size={13} />
                Edit log
              </button>
          )}

          {canDelete && (
              <button
                type="button"
                onClick={() => { setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--danger)] transition-colors"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sidebar)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <Trash2 size={13} />
                Remove log
              </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LogCard({
  log,
  contacts,
  signals,
  canEdit,
  canDelete,
  currentUserName,
  clientId,
  isActive,
  onEdit,
  onDelete,
  onFollowedUp,
}: {
  log: Log;
  contacts: Contact[];
  signals: LogSignal[];
  canEdit: boolean;
  canDelete: boolean;
  currentUserName: string;
  clientId: string;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFollowedUp: (updated: Log) => void;
}) {
  const router = useRouter();

  const contactIds = log.contactIds?.length ? log.contactIds : (log.contactId ? [log.contactId] : []);
  const contactLabels = contactIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => `${c!.firstName} ${c!.lastName}`);

  const resolvedSignals = (log.signals ?? []).length > 0
    ? log.signals!
    : log.signalIds.map((id) => signals.find((s) => s.id === id)?.name ?? id);


  async function handleMarkFollowedUp() {
    const res = await fetch(`/api/clients/${clientId}/logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followedUpAt: today(), followedUpByName: currentUserName }),
    });
    if (!res.ok) return;
    const updated: Log = await res.json();
    updated.signals = updated.signalIds.map((id) => signals.find((s) => s.id === id)?.name ?? id);
    onFollowedUp(updated);
    router.refresh();
  }

  async function handleUndoFollowUp() {
    const res = await fetch(`/api/clients/${clientId}/logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followedUpAt: null, followedUpByName: null }),
    });
    if (!res.ok) return;
    const updated: Log = await res.json();
    updated.signals = updated.signalIds.map((id) => signals.find((s) => s.id === id)?.name ?? id);
    onFollowedUp(updated);
    router.refresh();
  }

  return (
    <div
      className="relative rounded-xl border p-4 space-y-2.5 bg-white dark:bg-[var(--bg-sidebar)]"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)" }}
    >
      {/* Menu button — absolute so it doesn't affect layout */}
      <div className="absolute top-3 right-3">
        <LogCardMenu
          canEdit={canEdit}
          canDelete={canDelete}
          hasFollowUp={!!(log.followUp && log.followUpDeadline)}
          alreadyFollowedUp={!!log.followedUpAt}
          onFollowUp={handleMarkFollowedUp}
          onUndoFollowUp={handleUndoFollowUp}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap pr-8" style={{ color: "var(--text-primary)" }}>
        {log.summary}
      </p>

      {/* Contacts */}
      {contactLabels.length > 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Contact: {contactLabels.join(", ")}
        </p>
      )}

      {/* Follow-up block */}
      {log.followUp && log.followUpDeadline && log.followUpAction && (
        <div className="flex flex-col gap-0.5">
          <span className="typo-tag" style={{ color: "var(--text-muted)" }}>
            Follow-up
          </span>
          <p className="text-sm font-medium" style={{ color: log.followedUpAt ? "var(--text-muted)" : "var(--primary)" }}>
            {log.followUpAction}
          </p>
          {log.followedUpAt && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <Check size={11} />
              Followed-up on {fmtDate(log.followedUpAt)}{log.followedUpByName ? ` by ${log.followedUpByName}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Signal pills */}
      {resolvedSignals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {resolvedSignals.map((name, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium border"
              style={{
                borderColor: "var(--primary)",
                color: "var(--primary)",
                opacity: isActive ? 1 : 0.35,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LogbookTab({
  clientId,
  clientName,
  initialLogs,
  signals,
  contacts,
  currentUserId,
  currentUserName,
  isAdmin,
  canCreateLog = true,
  canEditAnyLog = false,
  canDeleteAnyLog = false,
}: {
  clientId: string;
  clientName: string;
  initialLogs: Log[];
  signals: LogSignal[];
  contacts: Contact[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  canCreateLog?: boolean;
  canEditAnyLog?: boolean;
  canDeleteAnyLog?: boolean;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  const [search, setSearch] = useState("");
  const [filterContact, setFilterContact] = useState("");
  const [filterSignal, setFilterSignal] = useState("");
  const [filterDate, setFilterDate] = useState("all");
  const [filterCreator, setFilterCreator] = useState("");

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
    setInline({ summary: "", contactIds: [] as string[], signalIds: [] as string[], followUp: false, followUpAction: "", followUpDeadline: "" });
    setInlineError("");
  }

  function toggleInlineSignal(id: string) {
    setInline((f) => ({
      ...f,
      signalIds: f.signalIds.includes(id) ? f.signalIds.filter((s) => s !== id) : [...f.signalIds, id],
    }));
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
    const saved: Log = await res.json();
    saved.signals = saved.signalIds.map((id) => signals.find((s) => s.id === id)?.name ?? id);
    setLogs((prev) => [saved, ...prev]);
    resetInline();
    router.refresh();
  }

  // Sync with server data after router.refresh() (e.g. after AddLogButton saves)
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  const uniqueCreators = useMemo(() => {
    const seen = new Map<string, string>();
    for (const log of logs) {
      if (!seen.has(log.createdById)) seen.set(log.createdById, log.createdByName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  const filtersActive = search || filterContact || filterSignal || filterDate !== "all" || filterCreator;

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = today();
    return sortedLogs.filter((log) => {
      if (search && !log.summary.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterContact) {
        const ids = log.contactIds?.length ? log.contactIds : (log.contactId ? [log.contactId] : []);
        if (!ids.includes(filterContact)) return false;
      }
      if (filterSignal && !log.signalIds.includes(filterSignal)) return false;
      if (filterCreator && log.createdById !== filterCreator) return false;
      if (filterDate !== "all") {
        const logDate = new Date(log.date + "T00:00:00");
        if (filterDate === "24h") {
          if (log.date !== todayStr) return false;
        } else if (filterDate === "week") {
          const dow = now.getDay();
          const diff = dow === 0 ? -6 : 1 - dow;
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() + diff);
          startOfWeek.setHours(0, 0, 0, 0);
          if (logDate < startOfWeek) return false;
        } else if (filterDate === "month") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (logDate < startOfMonth) return false;
        } else if (filterDate === "6months") {
          const sixMonthsAgo = new Date(now);
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          if (logDate < sixMonthsAgo) return false;
        } else if (filterDate === "year") {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          if (logDate < startOfYear) return false;
        }
      }
      return true;
    });
  }, [sortedLogs, search, filterContact, filterSignal, filterDate, filterCreator]);

  function clearFilters() {
    setSearch("");
    setFilterContact("");
    setFilterSignal("");
    setFilterDate("all");
    setFilterCreator("");
  }

  function openEditPanel(log: Log) {
    openPanel(
      "Edit log entry",
      <LogForm
        clientId={clientId}
        clientName={clientName}
        contacts={contacts}
        signals={signals}
        currentUserName={currentUserName}
        initial={log}
        onSaved={(updated) =>
          setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
        }
        onClose={closePanel}
      />
    );
  }

  async function handleDelete(log: Log) {
    if (!confirm("Delete this log entry? This cannot be undone.")) return;
    const res = await fetch(`/api/clients/${clientId}/logs/${log.id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <LogbookStats logs={logs} signals={signals} sortedLogs={sortedLogs} />

      {/* ── Filter bar ── */}
      {logs.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          {/* Row 1: Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2">
            {/* Date */}
            <div className="relative flex-1">
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="appearance-none w-full rounded-lg border pl-2.5 pr-7 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40 cursor-pointer"
                style={{ background: "var(--bg-sidebar)", borderColor: filterDate !== "all" ? "var(--primary)" : "var(--border)", color: filterDate !== "all" ? "var(--primary)" : "var(--text-muted)" }}
              >
                <option value="all">All time</option>
                <option value="24h">Last 24 hours</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="6months">Last 6 months</option>
                <option value="year">This year</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: filterDate !== "all" ? "var(--primary)" : "var(--text-muted)" }} />
            </div>

            {/* Contact */}
            {contacts.length > 0 && (
              <div className="relative flex-1">
                <select
                  value={filterContact}
                  onChange={(e) => setFilterContact(e.target.value)}
                  className="appearance-none w-full rounded-lg border pl-2.5 pr-7 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40 cursor-pointer"
                  style={{ background: "var(--bg-sidebar)", borderColor: filterContact ? "var(--primary)" : "var(--border)", color: filterContact ? "var(--primary)" : "var(--text-muted)" }}
                >
                  <option value="">Contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: filterContact ? "var(--primary)" : "var(--text-muted)" }} />
              </div>
            )}

            {/* Signal */}
            {signals.length > 0 && (
              <div className="relative flex-1">
                <select
                  value={filterSignal}
                  onChange={(e) => setFilterSignal(e.target.value)}
                  className="appearance-none w-full rounded-lg border pl-2.5 pr-7 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40 cursor-pointer"
                  style={{ background: "var(--bg-sidebar)", borderColor: filterSignal ? "var(--primary)" : "var(--border)", color: filterSignal ? "var(--primary)" : "var(--text-muted)" }}
                >
                  <option value="">Signal</option>
                  {signals.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: filterSignal ? "var(--primary)" : "var(--text-muted)" }} />
              </div>
            )}

            {/* User */}
            <div className="relative flex-1">
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="appearance-none w-full rounded-lg border pl-2.5 pr-7 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40 cursor-pointer"
                style={{ background: "var(--bg-sidebar)", borderColor: filterCreator ? "var(--primary)" : "var(--border)", color: filterCreator ? "var(--primary)" : "var(--text-muted)" }}
              >
                <option value="">User</option>
                <option value={currentUserId}>Me</option>
                {uniqueCreators.filter(({ id }) => id !== currentUserId).map(({ id, name }) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: filterCreator ? "var(--primary)" : "var(--text-muted)" }} />
            </div>

            {/* Clear */}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm btn-ghost shrink-0" style={{ color: "var(--primary)" }}
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Inline quick-entry ── */}
      {canCreateLog && <div className="relative" style={{ marginBottom: filteredLogs.length > 0 ? "64px" : 0 }}>
        {/* Timeline connector to first real entry */}
        {filteredLogs.length > 0 && (
          <div
            className="absolute w-px"
            style={{ left: "17px", top: "8px", bottom: "-72px", background: "var(--primary)", opacity: 0.2, zIndex: 0 }}
          />
        )}

        {/* Dot + header */}
        <div className="relative z-20 flex items-center gap-2.5 mb-2 pl-3">
          <div className="w-3 h-3 rounded-full flex-none relative z-10 bg-white" style={{ border: "1.5px dotted var(--primary)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {fmtDate(today())}
            <span className="mx-1.5">·</span>
            {currentUserName}
          </p>
        </div>

        {/* Card */}
        <div
          className="relative rounded-xl border bg-white dark:bg-[var(--bg-sidebar)]"
          style={{ borderColor: "var(--primary)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04), 0 0 28px 4px color-mix(in srgb, var(--primary) 12%, transparent)", padding: "1rem", zIndex: 1 }}
        >
          <textarea
            placeholder="What happened…"
            value={inline.summary}
            onChange={(e) => setInline((f) => ({ ...f, summary: e.target.value }))}
            rows={3}
            className="w-full text-sm leading-relaxed resize-none bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />

          {inline.summary && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Contact */}
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
                          onClick={() => setInline((f) => ({
                            ...f,
                            contactIds: active ? f.contactIds.filter((id) => id !== c.id) : [...f.contactIds, c.id],
                          }))}
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

              {/* Signals */}
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
                          onClick={() => toggleInlineSignal(s.id)}
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

              {/* Follow-up */}
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
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={inline.followUpDeadline}
                        onChange={(e) => setInline((f) => ({ ...f, followUpDeadline: e.target.value }))}
                        className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                        style={{ background: "var(--bg-sidebar)", borderColor: inline.followUpDeadline ? "var(--border)" : "var(--danger)", color: "var(--text-primary)", width: "auto" }}
                        required
                      />
                      <span className="text-[var(--danger)] text-xs">*</span>
                    </div>
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
                      style={{ background: "var(--bg-sidebar)", borderColor: inline.followUpAction ? "var(--border)" : "var(--danger)", color: "var(--text-primary)" }}
                    />
                  </div>
                )}
              </div>

              {inlineError && <p className="text-xs text-[var(--danger)]">{inlineError}</p>}

              {/* Actions */}
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
      </div>}

      {/* Empty state */}
      {sortedLogs.length === 0 && (
        <div className="flex items-center justify-center h-16">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No log entries yet.</p>
        </div>
      )}
      {sortedLogs.length > 0 && filteredLogs.length === 0 && (
        <div className="flex items-center justify-center h-16">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No logs match your filters.</p>
        </div>
      )}

      {filteredLogs.map((log, idx) => {
        const isLast = idx === filteredLogs.length - 1;
        const canEdit = !log.isSystemGenerated && (canEditAnyLog || log.createdById === currentUserId);
        const canDelete = !log.isSystemGenerated && (canDeleteAnyLog || log.createdById === currentUserId);
        const isActive = !!(log.followUp && log.followUpDeadline && !log.followedUpAt);
        const isOverdue = isActive && log.followUpDeadline! < today();

        return (
          <div key={log.id} className="relative" style={{ marginBottom: isLast ? 0 : "24px" }}>
            {/* Timeline connector line: from dot center to dot center of next item */}
            {!isLast && (
              <div
                className="absolute w-px"
                style={{
                  left: "17px",
                  top: "8px",
                  bottom: "-32px",
                  background: "var(--primary)",
                  opacity: 0.2,
                  zIndex: 0,
                }}
              />
            )}

            {/* Dot + date/user row */}
            <div className="flex items-center gap-2.5 mb-2 pl-3">
              <div
                className="w-3 h-3 rounded-full flex-none relative z-10"
                style={{ background: "var(--bg-surface)" }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: isOverdue ? "var(--danger)" : "var(--primary)", opacity: isActive ? 1 : 0.25 }}
                />
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {fmtDate(log.date)}
                <span className="mx-1.5">·</span>
                {log.createdByName}
              </p>
              {log.followUp && !log.followedUpAt && log.followUpDeadline && (
                <p className="ml-auto text-xs font-medium whitespace-nowrap" style={{ color: isOverdue ? "var(--danger)" : "var(--primary)" }}>
                  Follow-up: {fmtDate(log.followUpDeadline)}
                </p>
              )}
            </div>

            {/* Card: full width, left edge aligned with dot */}
            <div className="relative">
            <LogCard
              log={log}
              contacts={contacts}
              signals={signals}
              canEdit={canEdit}
              canDelete={canDelete}
              currentUserName={currentUserName}
              clientId={clientId}
              isActive={isActive}
              onEdit={() => openEditPanel(log)}
              onDelete={() => handleDelete(log)}
              onFollowedUp={(updated) =>
                setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
              }
            />
            </div>
          </div>
        );
      })}
    </div>
  );
}
