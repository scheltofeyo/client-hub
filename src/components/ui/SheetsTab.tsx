"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Pencil, Trash2, Plus, SlidersHorizontal, Check, X } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Sheet } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

// ── Sheet Manager Panel ──────────────────────────────────────

function SheetManagerPanel({
  clientId,
  initialSheets,
  onSheetsChange,
}: {
  clientId: string;
  initialSheets: Sheet[];
  onSheetsChange?: (sheets: Sheet[]) => void;
}) {
  const [sheets, setSheets] = useState(initialSheets);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Sheet | null>(null);
  const [form, setForm] = useState({ name: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function openAdd() {
    setForm({ name: "", url: "" });
    setError("");
    setMode("add");
  }

  function openEdit(sheet: Sheet) {
    setEditTarget(sheet);
    setForm({ name: sheet.name, url: sheet.url });
    setError("");
    setMode("edit");
  }

  function cancelForm() {
    setMode("list");
    setEditTarget(null);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const url = editTarget
      ? `/api/clients/${clientId}/sheets/${editTarget.id}`
      : `/api/clients/${clientId}/sheets`;
    const method = editTarget ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, url: form.url }),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to save sheet");
      return;
    }

    const saved: Sheet = await res.json();
    const updated = editTarget
      ? sheets.map((s) => (s.id === saved.id ? saved : s))
      : [...sheets, saved];

    setSheets(updated);
    onSheetsChange?.(updated);
    window.dispatchEvent(new CustomEvent("sheets-updated", { detail: { clientId } }));
    router.refresh();
    cancelForm();
  }

  async function handleDelete(sheet: Sheet) {
    if (!confirm(`Remove "${sheet.name}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/clients/${clientId}/sheets/${sheet.id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;

    const updated = sheets.filter((s) => s.id !== sheet.id);
    setSheets(updated);
    onSheetsChange?.(updated);
    window.dispatchEvent(new CustomEvent("sheets-updated", { detail: { clientId } }));
    router.refresh();
  }

  if (mode === "add" || mode === "edit") {
    return (
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div>
          <label className={labelClass} style={labelStyle}>
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Q2 Planning"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Google Sheets URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className={inputClass}
            style={inputStyle}
          />
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Share the sheet with your team via File → Share, or set access to &ldquo;Anyone with the link&rdquo;. No need to publish.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={saving || !form.name.trim() || !form.url.trim()}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
          >
            <Check size={13} />
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add sheet"}
          </button>
          <button
            type="button"
            onClick={cancelForm}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm btn-ghost"
          >
            <X size={13} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sheets.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No sheets added yet.
        </p>
      )}

      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
            {sheet.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => openEdit(sheet)}
              className="p-1.5 rounded-md btn-icon"
              title="Rename"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(sheet)}
              className="p-1.5 rounded-md btn-icon text-red-500"
              title="Remove"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={openAdd}
        className="flex items-center gap-1.5 mt-1 px-3 py-2 rounded-lg text-sm btn-ghost w-full"
      >
        <Plus size={13} />
        Add sheet
      </button>
    </div>
  );
}

// ── Manage Sheets Button ─────────────────────────────────────

export function ManageSheetsButton({
  clientId,
  initialSheets,
  onSheetsChange,
}: {
  clientId: string;
  initialSheets: Sheet[];
  onSheetsChange?: (sheets: Sheet[]) => void;
}) {
  const { openPanel } = useRightPanel();

  function open() {
    openPanel(
      "Manage Sheets",
      <SheetManagerPanel
        clientId={clientId}
        initialSheets={initialSheets}
        onSheetsChange={onSheetsChange}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-primary"
    >
      <SlidersHorizontal size={14} />
      Manage Sheets
    </button>
  );
}

// ── Sheets Tab ───────────────────────────────────────────────

export default function SheetsTab({
  clientId,
  initialSheets,
}: {
  clientId: string;
  initialSheets: Sheet[];
}) {
  const [sheets, setSheets] = useState(initialSheets);

  useEffect(() => {
    setSheets(initialSheets);
  }, [initialSheets]);

  if (sheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No sheets added yet. Click &ldquo;Manage Sheets&rdquo; to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {sheets.map((sheet) => (
        <Link
          key={sheet.id}
          href={`/clients/${clientId}/sheets/${sheet.id}`}
          className="rounded-2xl border p-5 flex items-center justify-between hover:border-purple-400 transition-colors block"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
            {sheet.name}
          </p>
          <ExternalLink size={14} style={{ color: "var(--text-muted)" }} />
        </Link>
      ))}
    </div>
  );
}
