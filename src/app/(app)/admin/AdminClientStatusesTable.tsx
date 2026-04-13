"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import type { ClientStatusOption } from "@/types";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function AddStatusForm({
  onCreated,
  onClose,
}: {
  onCreated: (s: ClientStatusOption) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [checkInDays, setCheckInDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const previewSlug = label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/client-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        checkInDays: checkInDays.trim() !== "" ? Number(checkInDays) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create status");
      return;
    }
    const created: ClientStatusOption = await res.json();
    onCreated(created);
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div>
        <label className="typo-label">
          Label <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          placeholder="e.g. On Hold"
          className={inputClass}
          style={inputStyle}
        />
        {previewSlug && (
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Slug: <span className="font-mono">{previewSlug}</span>
          </p>
        )}
      </div>
      <div>
        <label className="typo-label">
          Check-in interval (days)
        </label>
        <input
          type="number"
          min={1}
          value={checkInDays}
          onChange={(e) => setCheckInDays(e.target.value)}
          placeholder="e.g. 30"
          className={inputClass}
          style={inputStyle}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          How many days until a check-in is due after last activity. Leave blank to disable.
        </p>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !label.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : "Save status"}
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

export default function AdminClientStatusesTable({
  initialStatuses,
}: {
  initialStatuses: ClientStatusOption[];
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingDays, setEditingDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel(
      "New client status",
      <AddStatusForm
        onCreated={(s) => setStatuses((prev) => [...prev, s])}
        onClose={closePanel}
      />
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...statuses];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setStatuses(next);
    await fetch("/api/client-statuses/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((s) => s.id) }),
    });
    router.refresh();
  }

  function startEdit(s: ClientStatusOption) {
    setEditingId(s.id);
    setEditingLabel(s.label);
    setEditingDays(s.checkInDays != null ? String(s.checkInDays) : "");
    setError("");
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client-statuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editingLabel,
          checkInDays: editingDays.trim() !== "" ? Number(editingDays) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Failed to update" }));
        setError(d.error ?? "Failed to update");
        return;
      }
      const updated: ClientStatusOption = await res.json();
      setStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete status "${label}"? Clients using this status will keep their value but it will no longer appear in dropdowns.`)) return;
    const res = await fetch(`/api/client-statuses/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setStatuses((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div
          className="rounded-xl border overflow-x-auto"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <table style={{ width: "100%", fontSize: "0.875rem" }}>
            <thead
              style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}
            >
              <tr>
                <th
                  className="px-4 py-3 typo-section-header text-left whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Label
                </th>
                <th
                  className="px-4 py-3 typo-section-header text-left whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Slug
                </th>
                <th
                  className="px-4 py-3 typo-section-header text-left whitespace-nowrap"
                  style={{ color: "var(--text-muted)", minWidth: 160 }}
                >
                  Check-in interval
                </th>
                <th
                  className="px-4 py-3 typo-section-header text-right whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Order
                </th>
                <th
                  className="px-4 py-3 typo-section-header text-right whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s, i) => (
                <tr
                  key={s.id}
                  className="group transition-colors"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {editingId === s.id ? (
                    <>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          autoFocus
                          placeholder="Label"
                          className={inputClass}
                          style={{ ...inputStyle, minWidth: 120 }}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          {s.slug}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={editingDays}
                            onChange={(e) => setEditingDays(e.target.value)}
                            placeholder="—"
                            className={inputClass}
                            style={{ ...inputStyle, width: 80 }}
                          />
                          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>days</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={saving || !editingLabel.trim()}
                            onClick={() => handleUpdate(s.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 btn-primary shrink-0"
                          >
                            <Check size={12} />
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs btn-ghost shrink-0"
                          >
                            <X size={12} />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          {s.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.checkInDays != null ? (
                          <span className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {s.checkInDays}{" "}
                            <span style={{ color: "var(--text-muted)" }}>days</span>
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            onClick={() => move(i, 1)}
                            disabled={i === statuses.length - 1}
                            className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => startEdit(s)}
                            className="p-1.5 rounded-md btn-icon"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.label)}
                            className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {statuses.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No statuses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={openAddPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New status
      </button>
    </div>
  );
}
