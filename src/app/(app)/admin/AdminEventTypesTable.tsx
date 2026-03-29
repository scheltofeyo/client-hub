"use client";

import { useState } from "react";
import {
  Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown, Lock,
  Users, Clock, Flag, Circle, CalendarDays, Star, Bell, Zap, Briefcase, Tag, PackageCheck,
} from "lucide-react";
import type { EventType } from "@/types";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";

const SYSTEM_SLUGS = ["deadline", "delivery"];

// ── Icon registry ────────────────────────────────────────────

const ICON_OPTIONS: { name: string; Icon: React.ElementType }[] = [
  { name: "Users",        Icon: Users        },
  { name: "Clock",        Icon: Clock        },
  { name: "Flag",         Icon: Flag         },
  { name: "Circle",       Icon: Circle       },
  { name: "CalendarDays", Icon: CalendarDays },
  { name: "Star",         Icon: Star         },
  { name: "Bell",         Icon: Bell         },
  { name: "Zap",          Icon: Zap          },
  { name: "Briefcase",    Icon: Briefcase    },
  { name: "Tag",          Icon: Tag          },
  { name: "PackageCheck", Icon: PackageCheck },
];

export const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map(({ name, Icon }) => [name, Icon])
);

const PRESET_COLORS = [
  "#6366f1", "#0d9488", "#ea580c", "#dc2626",
  "#16a34a", "#2563eb", "#d97706", "#94a3b8",
  "#db2777", "#7c3aed",
];

// ── Shared input styles ──────────────────────────────────────

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

// ── ColorIconPicker ──────────────────────────────────────────

function ColorIconPicker({
  color,
  icon,
  onColorChange,
  onIconChange,
}: {
  color: string;
  icon: string;
  onColorChange: (c: string) => void;
  onIconChange: (i: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className={labelClass} style={labelStyle}>Color</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              className="w-6 h-6 rounded-full border-2 transition-all"
              style={{
                background: c,
                borderColor: color === c ? "var(--text-primary)" : "transparent",
                transform: color === c ? "scale(1.15)" : undefined,
              }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border"
            style={{ borderColor: "var(--border)" }}
            title="Custom colour"
          />
        </div>
      </div>
      <div>
        <p className={labelClass} style={labelStyle}>Icon</p>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => onIconChange(name)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors"
              style={
                icon === name
                  ? { background: color, color: "#fff", borderColor: color }
                  : { background: "var(--bg-sidebar)", color: "var(--text-muted)", borderColor: "var(--border)" }
              }
              title={name}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Add form ─────────────────────────────────────────────────

function AddEventTypeForm({
  onCreated,
  onClose,
}: {
  onCreated: (et: EventType) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [icon, setIcon] = useState("Circle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color, icon }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create event type");
      return;
    }
    const created: EventType = await res.json();
    onCreated(created);
    router.refresh();
    onClose();
  }

  const Icon = ICON_MAP[icon] ?? Circle;

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
          placeholder="e.g. Workshop"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <ColorIconPicker
        color={color}
        icon={icon}
        onColorChange={setColor}
        onIconChange={setIcon}
      />
      {label.trim() && (
        <div className="flex items-center gap-2 py-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Preview:</span>
          <span
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: `${color}18`, color }}
          >
            <Icon size={10} strokeWidth={2} />
            {label}
          </span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !label.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : "Save event type"}
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

// ── Main table ────────────────────────────────────────────────

export default function AdminEventTypesTable({
  initialEventTypes,
}: {
  initialEventTypes: EventType[];
}) {
  const [eventTypes, setEventTypes] = useState(initialEventTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editIcon, setEditIcon] = useState("Circle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel(
      "New event type",
      <AddEventTypeForm
        onCreated={(et) => setEventTypes((prev) => [...prev, et])}
        onClose={closePanel}
      />
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...eventTypes];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setEventTypes(next);
    await fetch("/api/event-types/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((et) => et.id) }),
    });
    router.refresh();
  }

  function startEdit(et: EventType) {
    setEditingId(et.id);
    setEditLabel(et.label);
    setEditColor(et.color);
    setEditIcon(et.icon);
    setError("");
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/event-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel, color: editColor, icon: editIcon }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to update");
      return;
    }
    const updated: EventType = await res.json();
    setEventTypes((prev) => prev.map((et) => (et.id === id ? { ...et, ...updated } : et)));
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete event type "${label}"? Existing events of this type will not be affected.`)) return;
    const res = await fetch(`/api/event-types/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setEventTypes((prev) => prev.filter((et) => et.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {eventTypes.map((et, i) => {
        const Icon = ICON_MAP[et.icon] ?? Circle;
        const EditIcon = ICON_MAP[editIcon] ?? Circle;

        return (
          <div
            key={et.id}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
          >
            {editingId === et.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  autoFocus
                  className={inputClass}
                  style={inputStyle}
                />
                <ColorIconPicker
                  color={editColor}
                  icon={editIcon}
                  onColorChange={setEditColor}
                  onIconChange={setEditIcon}
                />
                {editLabel.trim() && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Preview:</span>
                    <span
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ background: `${editColor}18`, color: editColor }}
                    >
                      <EditIcon size={10} strokeWidth={2} />
                      {editLabel}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving || !editLabel.trim()}
                    onClick={() => handleUpdate(et.id)}
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
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: `${et.color}18`, color: et.color }}
                  >
                    <Icon size={10} strokeWidth={2} />
                    {et.label}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {et.slug}
                  </span>
                  {SYSTEM_SLUGS.includes(et.slug) && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: "var(--border)", color: "var(--text-muted)" }}
                      title="Used by auto-generated events — cannot be modified"
                    >
                      <Lock size={9} />
                      system
                    </span>
                  )}
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
                    disabled={i === eventTypes.length - 1}
                    className="p-1.5 rounded-md btn-icon disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown size={13} />
                  </button>
                  {!SYSTEM_SLUGS.includes(et.slug) && (
                    <>
                      <button
                        onClick={() => startEdit(et)}
                        className="p-1.5 rounded-md btn-icon"
                        title="Edit event type"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(et.id, et.label)}
                        className="p-1.5 rounded-md btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete event type"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {eventTypes.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No event types yet.
        </p>
      )}

      <button
        onClick={openAddPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New event type
      </button>
    </div>
  );
}
