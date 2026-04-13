"use client";

import { useState } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
import type { CompanyHoliday } from "@/types";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export default function AdminCompanyHolidaysTable({
  initialHolidays,
}: {
  initialHolidays: CompanyHoliday[];
}) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAdd() {
    if (!newDate || !newLabel.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/company-holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, label: newLabel.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to add");
      return;
    }
    const created: CompanyHoliday = await res.json();
    setHolidays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
    setNewLabel("");
    setShowAdd(false);
    router.refresh();
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete company holiday "${label}"?`)) return;
    const res = await fetch(`/api/company-holidays/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    router.refresh();
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      {holidays.map((h) => (
        <div
          key={h.id}
          className="rounded-xl border p-4 flex items-center justify-between gap-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <div className="flex items-center gap-3">
            <Calendar size={16} style={{ color: "var(--primary)" }} />
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {h.label}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {formatDate(h.date)}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDelete(h.id, h.label)}
            className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)] shrink-0"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {holidays.length === 0 && !showAdd && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No company holidays set. Add holidays that apply to all team members.
        </p>
      )}

      {showAdd ? (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="typo-label">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label className="typo-label">Label</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Christmas Day"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !newDate || !newLabel.trim()}
              onClick={handleAdd}
              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add holiday"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setError(""); }}
              className="btn-ghost text-sm px-4 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
          style={{ borderColor: "var(--border)" }}
        >
          <Plus size={13} />
          Add company holiday
        </button>
      )}
    </div>
  );
}
