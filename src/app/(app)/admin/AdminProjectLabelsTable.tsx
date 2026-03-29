"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import type { ProjectLabel } from "@/types";
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

function AddLabelForm({
  onCreated,
  onClose,
}: {
  onCreated: (l: ProjectLabel) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/project-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create label");
      return;
    }
    const created: ProjectLabel = await res.json();
    onCreated(created);
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div>
        <label className={labelClass} style={labelStyle}>
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. New Business"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : "Save label"}
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

export default function AdminProjectLabelsTable({
  initialLabels,
}: {
  initialLabels: ProjectLabel[];
}) {
  const [labels, setLabels] = useState(initialLabels);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel(
      "New project label",
      <AddLabelForm
        onCreated={(l) => setLabels((prev) => [...prev, l])}
        onClose={closePanel}
      />
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...labels];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setLabels(next);
    await fetch("/api/project-labels/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((l) => l.id) }),
    });
    router.refresh();
  }

  function startEdit(l: ProjectLabel) {
    setEditingId(l.id);
    setEditingName(l.name);
    setError("");
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/project-labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to update");
      return;
    }
    const updated: ProjectLabel = await res.json();
    setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete label "${name}"? Projects using this label will keep their value but it will no longer appear in dropdowns.`)) return;
    const res = await fetch(`/api/project-labels/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setLabels((prev) => prev.filter((l) => l.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {labels.map((l, i) => (
        <div
          key={l.id}
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          {editingId === l.id ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                className={inputClass}
                style={inputStyle}
              />
              <button
                type="button"
                disabled={saving || !editingName.trim()}
                onClick={() => handleUpdate(l.id)}
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
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {l.name}
              </p>
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
                  disabled={i === labels.length - 1}
                  className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  onClick={() => startEdit(l)}
                  className="p-1.5 rounded-md btn-icon"
                  title="Edit label"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(l.id, l.name)}
                  className="p-1.5 rounded-md btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete label"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {labels.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No labels yet.
        </p>
      )}

      <button
        onClick={openAddPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New label
      </button>
    </div>
  );
}
