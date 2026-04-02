"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import type { Service } from "@/types";
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

function AddServiceForm({
  onCreated,
  onClose,
}: {
  onCreated: (s: Service) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [checkInDays, setCheckInDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        checkInDays: checkInDays.trim() !== "" ? Number(checkInDays) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create service");
      return;
    }
    const created: Service = await res.json();
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
          placeholder="e.g. Website"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>
          Check-in interval (days)
        </label>
        <input
          type="number"
          min={1}
          value={checkInDays}
          onChange={(e) => setCheckInDays(e.target.value)}
          placeholder="e.g. 90"
          className={inputClass}
          style={inputStyle}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Days after delivery before a follow-up check-in is due. Leave blank to disable.
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
          {saving ? "Saving…" : "Save service"}
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

export default function AdminServicesTable({
  initialServices,
}: {
  initialServices: Service[];
}) {
  const [services, setServices] = useState(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDays, setEditingDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel(
      "New service",
      <AddServiceForm
        onCreated={(s) => setServices((prev) => [...prev, s])}
        onClose={closePanel}
      />
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...services];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setServices(next);
    await fetch("/api/services/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((s) => s.id) }),
    });
    router.refresh();
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setEditingName(s.name);
    setEditingDays(s.checkInDays != null ? String(s.checkInDays) : "");
    setError("");
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName,
          checkInDays: editingDays.trim() !== "" ? Number(editingDays) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Failed to update" }));
        setError(d.error ?? "Failed to update");
        return;
      }
      const updated: Service = await res.json();
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete service "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-500">{error}</p>}

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
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Name
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left whitespace-nowrap"
                  style={{ color: "var(--text-muted)", minWidth: 160 }}
                >
                  Check-in interval
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Order
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
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
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          placeholder="Name"
                          className={inputClass}
                          style={{ ...inputStyle, minWidth: 120 }}
                        />
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
                            disabled={saving || !editingName.trim()}
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
                          {s.name}
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
                            disabled={i === services.length - 1}
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
                            title="Edit service"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-1.5 rounded-md btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete service"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {services.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No services yet.
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
        New service
      </button>

      <div
        className="rounded-lg border px-4 py-3 text-xs leading-relaxed space-y-1"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-elevated)" }}
      >
        <p className="font-medium" style={{ color: "var(--text-secondary)" }}>How check-in intervals work</p>
        <p>
          When a check-in interval is set and a project with this service is completed, a countdown begins.
          When the interval expires:
        </p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>A logbook entry is created automatically: &quot;{"{Service}"} expired today&quot;</li>
          <li>A follow-up task is generated: &quot;Check in about expired service: {"{Service}"}&quot;</li>
          <li>An &quot;Expired service&quot; event appears on the client&apos;s Events timeline</li>
        </ul>
        <p>
          Completing the task (or marking the follow-up as done) dismisses the event and resets the timer from that date.
        </p>
      </div>
    </div>
  );
}
