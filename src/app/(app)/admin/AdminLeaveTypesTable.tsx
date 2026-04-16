"use client";

import { useState, useEffect } from "react";
import {
  Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown,
  Sun, Thermometer, User, Circle, Palmtree, Baby, GraduationCap, Heart, Briefcase, Plane,
} from "lucide-react";
import type { LeaveType } from "@/types";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import Toggle from "@/components/ui/Toggle";

const SYSTEM_LEAVE_SLUGS = new Set(["vacation", "sick", "personal"]);

const ICON_OPTIONS: { name: string; Icon: React.ElementType }[] = [
  { name: "Sun",            Icon: Sun            },
  { name: "Thermometer",    Icon: Thermometer    },
  { name: "User",           Icon: User           },
  { name: "Palmtree",       Icon: Palmtree       },
  { name: "Baby",           Icon: Baby           },
  { name: "GraduationCap",  Icon: GraduationCap  },
  { name: "Heart",          Icon: Heart          },
  { name: "Briefcase",      Icon: Briefcase      },
  { name: "Plane",          Icon: Plane          },
  { name: "Circle",         Icon: Circle         },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map(({ name, Icon }) => [name, Icon])
);

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

function ColorIconPicker({
  color, icon, onColorChange, onIconChange,
}: {
  color: string; icon: string; onColorChange: (c: string) => void; onIconChange: (i: string) => void;
}) {
  const [hexInput, setHexInput] = useState(color.replace("#", ""));
  useEffect(() => { setHexInput(color.replace("#", "")); }, [color]);
  return (
    <div className="space-y-3">
      <div>
        <p className="typo-label">Color</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              const clean = e.target.value.replace("#", "").slice(0, 6);
              if (/^[0-9a-fA-F]{0,6}$/.test(clean)) {
                setHexInput(clean);
                if (/^[0-9a-fA-F]{6}$/.test(clean)) onColorChange(`#${clean}`);
              }
            }}
            onBlur={() => { if (!/^[0-9a-fA-F]{6}$/.test(hexInput)) setHexInput(color.replace("#", "")); }}
            maxLength={6}
            className="w-20 px-2 py-1 rounded-button border text-xs font-mono"
            style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
            placeholder="7c3aed"
          />
          <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)}
            className="w-6 h-6 rounded-full cursor-pointer border-0 p-0" style={{ backgroundColor: "transparent" }}
            title="Pick a colour" />
        </div>
      </div>
      <div>
        <p className="typo-label">Icon</p>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map(({ name, Icon }) => (
            <button key={name} type="button" onClick={() => onIconChange(name)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors"
              style={icon === name ? { background: color, color: "#fff", borderColor: color } : { background: "var(--bg-sidebar)", color: "var(--text-muted)", borderColor: "var(--border)" }}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddLeaveTypeForm({ onCreated, onClose }: { onCreated: (lt: LeaveType) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [icon, setIcon] = useState("Sun");
  const [countsAgainstAllowance, setCountsAgainstAllowance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/leave-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color, icon, countsAgainstAllowance }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    const created: LeaveType = await res.json();
    onCreated(created);
    router.refresh();
    onClose();
  }

  const Icon = ICON_MAP[icon] ?? Circle;
  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <div>
        <label className="typo-label">Label <span className="text-[var(--danger)]">*</span></label>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus placeholder="e.g. Parental Leave" className={inputClass} style={inputStyle} />
      </div>
      <ColorIconPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />
      <div className="flex items-center gap-3">
        <Toggle checked={countsAgainstAllowance} onChange={() => setCountsAgainstAllowance((v) => !v)} />
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>Counts against vacation allowance</span>
      </div>
      {label.trim() && (
        <div className="flex items-center gap-2 py-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Preview:</span>
          <span className="flex items-center gap-1 typo-tag px-1.5 py-0.5 rounded" style={{ background: `${color}18`, color }}>
            <Icon size={10} strokeWidth={2} />{label}
          </span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" disabled={saving || !label.trim()} onClick={handleSubmit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary">
          <Check size={13} />{saving ? "Saving..." : "Save leave type"}
        </button>
        <button type="button" onClick={onClose} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm btn-ghost"><X size={13} />Cancel</button>
      </div>
    </div>
  );
}

export default function AdminLeaveTypesTable({ initialLeaveTypes }: { initialLeaveTypes: LeaveType[] }) {
  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#7c3aed");
  const [editIcon, setEditIcon] = useState("Sun");
  const [editCounts, setEditCounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel("New leave type", <AddLeaveTypeForm onCreated={(lt) => setLeaveTypes((p) => [...p, lt])} onClose={closePanel} />);
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...leaveTypes];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setLeaveTypes(next);
    await fetch("/api/leave-types/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((lt) => lt.id) }) });
    router.refresh();
  }

  function startEdit(lt: LeaveType) {
    setEditingId(lt.id);
    setEditLabel(lt.label);
    setEditColor(lt.color);
    setEditIcon(lt.icon);
    setEditCounts(lt.countsAgainstAllowance);
    setError("");
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/leave-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel, color: editColor, icon: editIcon, countsAgainstAllowance: editCounts }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    const updated: LeaveType = await res.json();
    setLeaveTypes((p) => p.map((lt) => (lt.id === id ? { ...lt, ...updated } : lt)));
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete leave type "${label}"?`)) return;
    const res = await fetch(`/api/leave-types/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setLeaveTypes((p) => p.filter((lt) => lt.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {leaveTypes.map((lt, i) => {
        const Icon = ICON_MAP[lt.icon] ?? Circle;
        const EditIcon = ICON_MAP[editIcon] ?? Circle;
        return (
          <div key={lt.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}>
            {editingId === lt.id ? (
              <div className="space-y-3">
                <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus className={inputClass} style={inputStyle} />
                <ColorIconPicker color={editColor} icon={editIcon} onColorChange={setEditColor} onIconChange={setEditIcon} />
                <div className="flex items-center gap-3">
                  <Toggle checked={editCounts} onChange={() => setEditCounts((v) => !v)} />
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>Counts against allowance</span>
                </div>
                {editLabel.trim() && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Preview:</span>
                    <span className="flex items-center gap-1 typo-tag px-1.5 py-0.5 rounded" style={{ background: `${editColor}18`, color: editColor }}>
                      <EditIcon size={10} strokeWidth={2} />{editLabel}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" disabled={saving || !editLabel.trim()} onClick={() => handleUpdate(lt.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary shrink-0">
                    <Check size={13} />{saving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm btn-ghost shrink-0"><X size={13} />Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 typo-tag px-1.5 py-0.5 rounded" style={{ background: `${lt.color}18`, color: lt.color }}>
                    <Icon size={10} strokeWidth={2} />{lt.label}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{lt.slug}</span>
                  {lt.countsAgainstAllowance && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
                      counts against allowance
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-md btn-icon disabled:opacity-30" title="Move up"><ChevronUp size={13} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === leaveTypes.length - 1} className="p-1.5 rounded-md btn-icon disabled:opacity-30" title="Move down"><ChevronDown size={13} /></button>
                  <button onClick={() => startEdit(lt)} className="p-1.5 rounded-md btn-icon" title="Edit"><Pencil size={13} /></button>
                  {!SYSTEM_LEAVE_SLUGS.has(lt.slug) && (
                    <button onClick={() => handleDelete(lt.id, lt.label)} className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]" title="Delete"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {leaveTypes.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No leave types yet.</p>}
      <button onClick={openAddPanel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border" style={{ borderColor: "var(--border)" }}>
        <Plus size={13} />New leave type
      </button>
    </div>
  );
}
