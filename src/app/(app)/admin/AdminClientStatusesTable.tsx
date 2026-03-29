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
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function AddStatusForm({
  onCreated,
  onClose,
}: {
  onCreated: (s: ClientStatusOption) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
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
      body: JSON.stringify({ label }),
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
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div>
        <label className={labelClass} style={labelStyle}>
          Label <span className="text-red-400">*</span>
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
    setError("");
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/client-statuses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editingLabel }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to update");
      return;
    }
    const updated: ClientStatusOption = await res.json();
    setStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    setEditingId(null);
    router.refresh();
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
      {error && <p className="text-xs text-red-500">{error}</p>}

      {statuses.map((s, i) => (
        <div
          key={s.id}
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          {editingId === s.id ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                autoFocus
                placeholder="Label"
                className={inputClass}
                style={inputStyle}
              />
              <button
                type="button"
                disabled={saving || !editingLabel.trim()}
                onClick={() => handleUpdate(s.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary shrink-0"
              >
                <Check size={13} />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm btn-ghost shrink-0"
              >
                <X size={13} />
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {s.label}
                </p>
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {s.slug}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
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
                <button
                  onClick={() => startEdit(s)}
                  className="p-1.5 rounded-md btn-icon"
                  title="Edit label"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.label)}
                  className="p-1.5 rounded-md btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete status"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {statuses.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No statuses yet.
        </p>
      )}

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
