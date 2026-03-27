"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Contact, Log, LogSignal } from "@/types";
import { fmtDate } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function today() {
  return new Date().toISOString().split("T")[0];
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
    contactId: initial?.contactId ?? "",
    date: initial?.date ?? today(),
    summary: initial?.summary ?? "",
    signalIds: initial?.signalIds ?? ([] as string[]),
    followUp: initial?.followUp ?? false,
    followUpDeadline: initial?.followUpDeadline ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function toggleSignal(id: string) {
    setForm((f) => ({
      ...f,
      signalIds: f.signalIds.includes(id)
        ? f.signalIds.filter((s) => s !== id)
        : [...f.signalIds, id],
    }));
  }

  async function handleSubmit() {
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
        contactId: form.contactId || undefined,
        date: form.date,
        summary: form.summary,
        signalIds: form.signalIds,
        followUp: form.followUp,
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
    <div className="space-y-4">
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <label className={labelClass} style={labelStyle}>Client</label>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{clientName}</p>
      </div>

      {contacts.length > 0 && (
        <div>
          <label className={labelClass} style={labelStyle}>Contact person</label>
          <select
            value={form.contactId}
            onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass} style={labelStyle}>
          Date <span className="text-red-400">*</span>
        </label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Summary <span className="text-red-400">*</span>
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

      {signals.length > 0 && (
        <div>
          <label className={labelClass} style={labelStyle}>Signals</label>
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
        <label className={labelClass} style={labelStyle}>Follow-up needed?</label>
        <div className="flex items-center gap-3 mt-1">
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
        </div>
        {form.followUp && (
          <div className="mt-3">
            <label className={labelClass} style={labelStyle}>Follow-up deadline</label>
            <input
              type="date"
              value={form.followUpDeadline}
              onChange={(e) => setForm((f) => ({ ...f, followUpDeadline: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        )}
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Logged by</label>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {initial?.createdByName ?? currentUserName}
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !form.date.trim() || !form.summary.trim()}
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

function LogCardMenu({
  canEdit,
  hasFollowUp,
  alreadyFollowedUp,
  onFollowUp,
  onUndoFollowUp,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  hasFollowUp: boolean;
  alreadyFollowedUp: boolean;
  onFollowUp: () => void;
  onUndoFollowUp: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
            <>
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

              <button
                type="button"
                onClick={() => { setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors"
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LogCard({
  log,
  contacts,
  signals,
  canEdit,
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
  currentUserName: string;
  clientId: string;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFollowedUp: (updated: Log) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const contactName = log.contactId
    ? contacts.find((c) => c.id === log.contactId)
    : null;
  const contactLabel = contactName
    ? `${contactName.firstName} ${contactName.lastName}`
    : null;

  const resolvedSignals = (log.signals ?? []).length > 0
    ? log.signals!
    : log.signalIds.map((id) => signals.find((s) => s.id === id)?.name ?? id);

  const isLong = log.summary.length > 200;
  const displaySummary =
    !expanded && isLong ? log.summary.slice(0, 200) + "…" : log.summary;

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
        {displaySummary}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs btn-link"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Contact */}
      {contactLabel && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Contact: {contactLabel}
        </p>
      )}

      {/* Followed-up row */}
      {log.followedUpAt && (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <Check size={11} />
          Followed-up on {fmtDate(log.followedUpAt)}{log.followedUpByName ? ` by ${log.followedUpByName}` : ""}
        </p>
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
}: {
  clientId: string;
  clientName: string;
  initialLogs: Log[];
  signals: LogSignal[];
  contacts: Contact[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  // Sync with server data after router.refresh() (e.g. after AddLogButton saves)
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

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

  if (sortedLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No log entries yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {sortedLogs.map((log, idx) => {
        const isLast = idx === sortedLogs.length - 1;
        const canEdit = isAdmin || log.createdById === currentUserId;
        const isActive = !!(log.followUp && log.followUpDeadline && !log.followedUpAt);

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
                  style={{ background: "var(--primary)", opacity: isActive ? 1 : 0.25 }}
                />
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {fmtDate(log.date)}
                <span className="mx-1.5">·</span>
                {log.createdByName}
              </p>
              {log.followUp && !log.followedUpAt && log.followUpDeadline && (
                <p className="ml-auto text-xs font-medium whitespace-nowrap" style={{ color: "var(--primary)" }}>
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
