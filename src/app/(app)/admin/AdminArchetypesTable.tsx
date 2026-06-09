"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import type { Archetype } from "@/types";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

const COLOR_PRESETS = [
  "#7C3AED", "#EF4444", "#3B82F6", "#10B981", "#F59E0B",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#84CC16",
];

function ArchetypeForm({
  initial,
  onSaved,
  onClose,
}: {
  initial?: Archetype;
  onSaved: (a: Archetype) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLOR_PRESETS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const url = isEdit ? `/api/archetypes/${initial!.id}` : "/api/archetypes";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color, description: description.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to save");
      return;
    }
    const saved: Archetype = await res.json();
    onSaved(saved);
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div>
        <label className="typo-label">
          Name <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. Achievement"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="typo-label">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#RRGGBB"
            className={inputClass}
            style={{ ...inputStyle, maxWidth: 140 }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: color.toLowerCase() === c.toLowerCase() ? "var(--text-primary)" : "transparent",
              }}
              title={c}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="typo-label">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Short description, max 280 characters"
          className={inputClass}
          style={inputStyle}
        />
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {description.length}/280
        </p>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save archetype"}
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

export default function AdminArchetypesTable({
  initialArchetypes,
}: {
  initialArchetypes: Archetype[];
}) {
  const [archetypes, setArchetypes] = useState(initialArchetypes);
  const [error, setError] = useState("");
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel(
      "New archetype",
      <ArchetypeForm
        onSaved={(a) => setArchetypes((prev) => [...prev, a])}
        onClose={closePanel}
      />
    );
  }

  function openEditPanel(a: Archetype) {
    openPanel(
      `Edit ${a.name}`,
      <ArchetypeForm
        initial={a}
        onSaved={(saved) =>
          setArchetypes((prev) => prev.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)))
        }
        onClose={closePanel}
      />
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...archetypes];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setArchetypes(next);
    await fetch("/api/archetypes/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((a) => a.id) }),
    });
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete archetype "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/archetypes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to delete");
      return;
    }
    setArchetypes((prev) => prev.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      {archetypes.map((a, i) => (
        <div
          key={a.id}
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="mt-0.5 h-6 w-6 rounded-full shrink-0 border"
                style={{ background: a.color, borderColor: "var(--border)" }}
                title={a.color}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {a.name}
                </p>
                {a.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {a.description}
                  </p>
                )}
              </div>
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
                disabled={i === archetypes.length - 1}
                className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown size={13} />
              </button>
              <button
                onClick={() => openEditPanel(a)}
                className="p-1.5 rounded-md btn-icon"
                title="Edit archetype"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDelete(a.id, a.name)}
                className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
                title="Delete archetype"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {archetypes.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No archetypes yet.
        </p>
      )}

      <button
        onClick={openAddPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-border border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New archetype
      </button>
    </div>
  );
}
