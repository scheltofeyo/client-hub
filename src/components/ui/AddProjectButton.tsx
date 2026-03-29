"use client";

import { useState, useEffect } from "react";
import { Plus, FileText, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { ProjectLabel, ProjectTemplate, Service } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function ProjectForm({
  clientId,
  template,
  services,
  labels,
  onBack,
  onClose,
}: {
  clientId: string;
  template: ProjectTemplate | null;
  services: Service[];
  labels: ProjectLabel[];
  onBack: () => void;
  onClose: () => void;
}) {
  function defaultDeliveryDate(days?: number): string {
    if (!days) return "";
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const [form, setForm] = useState({
    title: template?.name ?? "",
    description: template?.defaultDescription ?? "",
    soldPrice: template?.defaultSoldPrice != null ? String(template.defaultSoldPrice) : "",
    serviceId: template?.defaultServiceId ?? "",
    labelId: "",
    deliveryDate: defaultDeliveryDate(template?.defaultDeliveryDays),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/api/clients/${clientId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
        templateId: template?.id,
        serviceId: form.serviceId || undefined,
        labelId: form.labelId || undefined,
        deliveryDate: form.deliveryDate || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const data = await res.json();
    onClose();
    router.push(`/clients/${clientId}/projects/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {template && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs btn-link mb-1"
        >
          <ArrowLeft size={12} />
          Change template
        </button>
      )}

      {template && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          <FileText size={13} className="mt-0.5 shrink-0" />
          <div>
            <span>Using template: <strong>{template.name}</strong></span>
            {(template.taskCount ?? 0) > 0 && (
              <p className="text-xs mt-0.5 opacity-75">
                {template.taskCount} task{template.taskCount === 1 ? "" : "s"} will be added automatically
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="ap-title" className={labelClass} style={labelStyle}>
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="ap-title"
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          autoFocus
          placeholder="e.g. Website Redesign"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <p className={labelClass} style={labelStyle}>
          Connect to a service <span className="text-red-400">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const selected = form.serviceId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => set("serviceId", s.id)}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors"
                style={
                  selected
                    ? {
                        background: "var(--primary)",
                        borderColor: "var(--primary)",
                        color: "#fff",
                      }
                    : {
                        background: "var(--bg-sidebar)",
                        borderColor: "var(--border)",
                        color: "var(--text-secondary)",
                      }
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="ap-description" className={labelClass} style={labelStyle}>
          Short description
        </label>
        <textarea
          id="ap-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="Describe the project scope…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div className="!mt-9">
        <label htmlFor="ap-delivery" className={labelClass} style={labelStyle}>
          Expected delivery date
        </label>
        <input
          id="ap-delivery"
          type="date"
          value={form.deliveryDate}
          onChange={(e) => set("deliveryDate", e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Automatically creates an event for this delivery.
        </p>
      </div>

      <div className="!mt-9">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Financial information
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ap-price" className={labelClass} style={labelStyle}>
              Sold price (€)
            </label>
            <input
              id="ap-price"
              type="number"
              min={0}
              step={1}
              value={form.soldPrice}
              onChange={(e) => set("soldPrice", e.target.value)}
              placeholder="e.g. 5000"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="ap-label" className={labelClass} style={labelStyle}>
              Label
            </label>
            <select
              id="ap-label"
              value={form.labelId}
              onChange={(e) => set("labelId", e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">— No label —</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !form.title.trim() || !form.serviceId}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Creating…" : "Create Project"}
        </button>
      </div>
    </form>
  );
}

export function TemplatePicker({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectTemplate | null | "clean">(undefined as unknown as ProjectTemplate | null | "clean");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/project-templates").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/project-labels").then((r) => r.json()),
    ])
      .then(([tplData, svcData, lblData]) => {
        setTemplates(Array.isArray(tplData) ? tplData : []);
        setServices(Array.isArray(svcData) ? svcData : []);
        setLabels(Array.isArray(lblData) ? lblData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (started) {
    const template = selected === "clean" ? null : (selected as ProjectTemplate);
    return (
      <ProjectForm
        clientId={clientId}
        template={template}
        services={services}
        labels={labels}
        onBack={() => setStarted(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Start from a template to pre-fill project details, or start with a blank project.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading templates…
        </p>
      ) : (
        <div className="space-y-2">
          {/* Start clean option */}
          <button
            type="button"
            onClick={() => { setSelected("clean"); setStarted(true); }}
            className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors hover:border-[var(--primary)]"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-sidebar)",
              color: "var(--text-primary)",
            }}
          >
            <span className="font-medium">Start clean</span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Blank project — fill in everything yourself
            </span>
          </button>

          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => { setSelected(tpl); setStarted(true); }}
              className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors hover:border-[var(--primary)]"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-sidebar)",
                color: "var(--text-primary)",
              }}
            >
              <span className="font-medium">{tpl.name}</span>
              {tpl.description && (
                <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {tpl.description}
                </span>
              )}
            </button>
          ))}

          {templates.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No templates yet. An admin can create them in the Admin panel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AddProjectButton({ clientId }: { clientId: string }) {
  const { openPanel, closePanel } = useRightPanel();

  function open() {
    openPanel(
      "New Project",
      <TemplatePicker clientId={clientId} onClose={closePanel} />
    );
  }

  return (
    <button
      onClick={open}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
    >
      <Plus size={13} />
      Add Project
    </button>
  );
}
