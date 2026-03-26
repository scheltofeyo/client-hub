"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import type { ProjectTemplate, Service } from "@/types";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function AddTemplateForm({
  services,
  onCreated,
  onClose,
}: {
  services: Service[];
  onCreated: (template: ProjectTemplate) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    defaultDescription: "",
    defaultSoldPrice: "",
    defaultServiceId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/project-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        defaultDescription: form.defaultDescription || undefined,
        defaultSoldPrice: form.defaultSoldPrice ? Number(form.defaultSoldPrice) : undefined,
        defaultServiceId: form.defaultServiceId || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to create template");
      return;
    }
    const created: ProjectTemplate = await res.json();
    onCreated(created);
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <label className={labelClass} style={labelStyle}>
          Template name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoFocus
          placeholder="e.g. Website Project"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Short description
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Shown to users when picking a template"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Default project description
        </label>
        <textarea
          value={form.defaultDescription}
          onChange={(e) => set("defaultDescription", e.target.value)}
          rows={3}
          placeholder="Pre-fills the project description field…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={labelStyle}>
            Default sold price (€)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={form.defaultSoldPrice}
            onChange={(e) => set("defaultSoldPrice", e.target.value)}
            placeholder="e.g. 5000"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Default service
          </label>
          <select
            value={form.defaultServiceId}
            onChange={(e) => set("defaultServiceId", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— None —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !form.name.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : "Save template"}
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

function EditTemplateForm({
  template,
  services,
  onUpdated,
  onClose,
}: {
  template: ProjectTemplate;
  services: Service[];
  onUpdated: (updated: ProjectTemplate) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: template.name,
    description: template.description ?? "",
    defaultDescription: template.defaultDescription ?? "",
    defaultSoldPrice: template.defaultSoldPrice != null ? String(template.defaultSoldPrice) : "",
    defaultServiceId: template.defaultServiceId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/project-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        defaultDescription: form.defaultDescription || undefined,
        defaultSoldPrice: form.defaultSoldPrice ? Number(form.defaultSoldPrice) : undefined,
        defaultServiceId: form.defaultServiceId || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to update template");
      return;
    }
    const updated: ProjectTemplate = await res.json();
    onUpdated(updated);
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <label className={labelClass} style={labelStyle}>
          Template name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoFocus
          placeholder="e.g. Website Project"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Short description
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Shown to users when picking a template"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Default project description
        </label>
        <textarea
          value={form.defaultDescription}
          onChange={(e) => set("defaultDescription", e.target.value)}
          rows={3}
          placeholder="Pre-fills the project description field…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={labelStyle}>
            Default sold price (€)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={form.defaultSoldPrice}
            onChange={(e) => set("defaultSoldPrice", e.target.value)}
            placeholder="e.g. 5000"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Default service
          </label>
          <select
            value={form.defaultServiceId}
            onChange={(e) => set("defaultServiceId", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— None —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !form.name.trim()}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Check size={13} />
          {saving ? "Saving…" : "Save template"}
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

export default function AdminTemplatesTable({
  initialTemplates,
  services,
}: {
  initialTemplates: ProjectTemplate[];
  services: Service[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();

  function openAddPanel() {
    openPanel(
      "New template",
      <AddTemplateForm
        services={services}
        onCreated={(t) => setTemplates((prev) => [t, ...prev])}
        onClose={closePanel}
      />
    );
  }

  function openEditPanel(tpl: ProjectTemplate) {
    openPanel(
      "Edit template",
      <EditTemplateForm
        template={tpl}
        services={services}
        onUpdated={(updated) =>
          setTemplates((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
        }
        onClose={closePanel}
      />
    );
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/project-templates/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {tpl.name}
              </p>
              {tpl.description && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {tpl.description}
                </p>
              )}
              <div className="flex gap-4 mt-1.5">
                {tpl.defaultSoldPrice != null && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Default price: €{tpl.defaultSoldPrice.toLocaleString()}
                  </span>
                )}
                {tpl.defaultServiceId && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Service: {services.find((s) => s.id === tpl.defaultServiceId)?.name ?? "—"}
                  </span>
                )}
                {tpl.defaultDescription && (
                  <span className="text-xs truncate max-w-xs" style={{ color: "var(--text-muted)" }}>
                    Default desc: {tpl.defaultDescription}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => openEditPanel(tpl)}
                className="p-1.5 rounded-md btn-icon"
                title="Edit template"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDelete(tpl.id, tpl.name)}
                className="p-1.5 rounded-md btn-icon text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete template"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No templates yet.
        </p>
      )}

      <button
        onClick={openAddPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New template
      </button>
    </div>
  );
}
