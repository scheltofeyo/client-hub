"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, ListTodo } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import { inputClass, inputStyle, labelClass, labelStyle } from "@/components/ui/form-styles";
import type { ProjectTemplate, Service } from "@/types";

/* ── Template settings form (shared between add + edit modals) ── */

interface TemplateFormState {
  name: string;
  description: string;
  defaultDescription: string;
  defaultSoldPrice: string;
  defaultServiceId: string;
  defaultDeliveryDays: string;
}

function TemplateSettingsFields({
  form,
  set,
  services,
}: {
  form: TemplateFormState;
  set: (field: string, value: string) => void;
  services: Service[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="tpl-name" className={labelClass} style={labelStyle}>
          Template name <span className="text-red-400">*</span>
        </label>
        <input
          id="tpl-name"
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Website Project"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <ServicePills
        services={services}
        selectedId={form.defaultServiceId}
        onChange={(id) => set("defaultServiceId", id)}
        label="Service"
        required
      />

      <div>
        <label htmlFor="tpl-desc" className={labelClass} style={labelStyle}>
          Short description
        </label>
        <input
          id="tpl-desc"
          type="text"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Shown to employees when picking a template"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="tpl-default-desc" className={labelClass} style={labelStyle}>
          Default project description
        </label>
        <textarea
          id="tpl-default-desc"
          value={form.defaultDescription}
          onChange={(e) => set("defaultDescription", e.target.value)}
          rows={3}
          placeholder="Pre-fills the project description field…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div className="!mt-9">
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Defaults
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tpl-price" className={labelClass} style={labelStyle}>
              Default sold price (€)
            </label>
            <input
              id="tpl-price"
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
            <label htmlFor="tpl-days" className={labelClass} style={labelStyle}>
              Default delivery days
            </label>
            <input
              id="tpl-days"
              type="number"
              min={1}
              step={1}
              value={form.defaultDeliveryDays}
              onChange={(e) => set("defaultDeliveryDays", e.target.value)}
              placeholder="e.g. 30"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */

export default function AdminTemplatesTable({
  initialTemplates,
  services,
}: {
  initialTemplates: ProjectTemplate[];
  services: Service[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const router = useRouter();

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<TemplateFormState>({
    name: "",
    description: "",
    defaultDescription: "",
    defaultSoldPrice: "",
    defaultServiceId: "",
    defaultDeliveryDays: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit modal state
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [editForm, setEditForm] = useState<TemplateFormState>({
    name: "",
    description: "",
    defaultDescription: "",
    defaultSoldPrice: "",
    defaultServiceId: "",
    defaultDeliveryDays: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  function openAdd() {
    setAddForm({
      name: "",
      description: "",
      defaultDescription: "",
      defaultSoldPrice: "",
      defaultServiceId: "",
      defaultDeliveryDays: "",
    });
    setAddError("");
    setAddOpen(true);
  }

  function openEdit(tpl: ProjectTemplate) {
    setEditForm({
      name: tpl.name,
      description: tpl.description ?? "",
      defaultDescription: tpl.defaultDescription ?? "",
      defaultSoldPrice: tpl.defaultSoldPrice != null ? String(tpl.defaultSoldPrice) : "",
      defaultServiceId: tpl.defaultServiceId ?? "",
      defaultDeliveryDays: tpl.defaultDeliveryDays != null ? String(tpl.defaultDeliveryDays) : "",
    });
    setEditError("");
    setEditingTemplate(tpl);
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.defaultServiceId) {
      setAddError("Name and service are required.");
      return;
    }
    setAddSaving(true);
    setAddError("");

    const res = await fetch("/api/project-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name,
        description: addForm.description || undefined,
        defaultDescription: addForm.defaultDescription || undefined,
        defaultSoldPrice: addForm.defaultSoldPrice ? Number(addForm.defaultSoldPrice) : undefined,
        defaultServiceId: addForm.defaultServiceId || undefined,
        defaultDeliveryDays: addForm.defaultDeliveryDays ? Number(addForm.defaultDeliveryDays) : undefined,
      }),
    });

    setAddSaving(false);

    if (!res.ok) {
      const d = await res.json();
      setAddError(d.error ?? "Failed to create template");
      return;
    }

    const created = await res.json();
    setAddOpen(false);
    // Navigate to template page so user can add tasks
    router.push(`/admin/templates/${created.id}`);
  }

  async function handleEdit() {
    if (!editingTemplate) return;
    if (!editForm.name.trim() || !editForm.defaultServiceId) {
      setEditError("Name and service are required.");
      return;
    }
    setEditSaving(true);
    setEditError("");

    const res = await fetch(`/api/project-templates/${editingTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || undefined,
        defaultDescription: editForm.defaultDescription || undefined,
        defaultSoldPrice: editForm.defaultSoldPrice ? Number(editForm.defaultSoldPrice) : undefined,
        defaultServiceId: editForm.defaultServiceId || undefined,
        defaultDeliveryDays: editForm.defaultDeliveryDays ? Number(editForm.defaultDeliveryDays) : undefined,
      }),
    });

    setEditSaving(false);

    if (!res.ok) {
      const d = await res.json();
      setEditError(d.error ?? "Failed to update template");
      return;
    }

    const updated = await res.json();
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingTemplate.id
          ? { ...t, ...updated }
          : t
      )
    );
    setEditingTemplate(null);
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
                onClick={() => openEdit(tpl)}
                className="p-1.5 rounded-md btn-icon"
                title="Edit settings"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => router.push(`/admin/templates/${tpl.id}`)}
                className="p-1.5 rounded-md btn-icon"
                title="Manage tasks"
              >
                <ListTodo size={13} />
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
        onClick={openAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
        style={{ borderColor: "var(--border)" }}
      >
        <Plus size={13} />
        New template
      </button>

      {/* Add template modal */}
      <SteppedModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New Template"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={addSaving || !addForm.name.trim() || !addForm.defaultServiceId}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
            >
              {addSaving ? "Creating…" : "Create Template"}
            </button>
          </>
        }
      >
        <TemplateSettingsFields
          form={addForm}
          set={(field, value) => setAddForm((f) => ({ ...f, [field]: value }))}
          services={services}
        />
        {addError && <p className="text-xs text-red-500 mt-3">{addError}</p>}
      </SteppedModal>

      {/* Edit template modal */}
      <SteppedModal
        open={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title="Edit Template"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEdit}
              disabled={editSaving || !editForm.name.trim() || !editForm.defaultServiceId}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
            >
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <TemplateSettingsFields
          form={editForm}
          set={(field, value) => setEditForm((f) => ({ ...f, [field]: value }))}
          services={services}
        />
        {editError && <p className="text-xs text-red-500 mt-3">{editError}</p>}
      </SteppedModal>
    </div>
  );
}
