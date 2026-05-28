"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { ProjectTemplate, Service } from "@/types";

/* ── Template settings form (shared between add + edit modals) ── */

interface TemplateFormState {
  name: string;
  summary: string;
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
        <label htmlFor="tpl-name" className="typo-label">
          Template name <span className="text-[var(--danger)]">*</span>
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
        <label htmlFor="tpl-summary" className="typo-label">
          Summary
        </label>
        <input
          id="tpl-summary"
          type="text"
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="Shown under the title when picking a template"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="typo-label">
          Default project description
        </label>
        <RichTextEditor
          content={form.defaultDescription}
          onChange={(html) => set("defaultDescription", html)}
          placeholder="Pre-fills the project description field…"
        />
      </div>

      <div className="!mt-9">
        <p
          className="typo-section-header mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Defaults
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tpl-price" className="typo-label">
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
            <label htmlFor="tpl-days" className="typo-label">
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
    summary: "",
    defaultDescription: "",
    defaultSoldPrice: "",
    defaultServiceId: "",
    defaultDeliveryDays: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  function openAdd() {
    setAddForm({
      name: "",
      summary: "",
      defaultDescription: "",
      defaultSoldPrice: "",
      defaultServiceId: "",
      defaultDeliveryDays: "",
    });
    setAddError("");
    setAddOpen(true);
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
        summary: addForm.summary || undefined,
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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/project-templates/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  // Service-first grouping. Group order follows the services array (already
  // rank-sorted); "Ungrouped" goes last and only renders when needed.
  const UNGROUPED_KEY = "__ungrouped__";
  const groups = useMemo(() => {
    const byService = new Map<string, ProjectTemplate[]>();
    for (const tpl of templates) {
      const key = tpl.defaultServiceId || UNGROUPED_KEY;
      const arr = byService.get(key) ?? [];
      arr.push(tpl);
      byService.set(key, arr);
    }
    const ordered: { id: string; name: string; items: ProjectTemplate[] }[] = [];
    for (const s of services) {
      const items = byService.get(s.id);
      if (items && items.length > 0) ordered.push({ id: s.id, name: s.name, items });
    }
    const ungrouped = byService.get(UNGROUPED_KEY);
    if (ungrouped && ungrouped.length > 0) {
      ordered.push({ id: UNGROUPED_KEY, name: "Ungrouped", items: ungrouped });
    }
    return ordered;
  }, [templates, services]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        return (
          <div key={group.id} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center gap-2 px-1 py-1 text-left"
            >
              {isCollapsed ? (
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              ) : (
                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
              )}
              <span className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                {group.name}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-badge tabular-nums"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {group.items.length}
              </span>
            </button>
            {!isCollapsed && (
              <div className="space-y-2">
                {group.items.map((tpl) => (
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
                        {tpl.summary && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {tpl.summary}
                          </p>
                        )}
                        {tpl.defaultDescription && (
                          <RichTextDisplay
                            html={tpl.defaultDescription}
                            className="text-xs mt-1.5 line-clamp-2"
                            style={{ color: "var(--text-muted)" }}
                          />
                        )}
                        {tpl.defaultSoldPrice != null && (
                          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                            Default price: €{tpl.defaultSoldPrice.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => router.push(`/admin/templates/${tpl.id}`)}
                          className="p-1.5 rounded-md btn-icon"
                          title="Edit template"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(tpl.id, tpl.name)}
                          className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
                          title="Delete template"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

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
        {addError && <p className="text-xs text-[var(--danger)] mt-3">{addError}</p>}
      </SteppedModal>
    </div>
  );
}
