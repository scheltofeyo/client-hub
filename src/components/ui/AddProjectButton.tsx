"use client";

import { useState, useEffect } from "react";
import { Plus, FileText, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { ProjectTemplate, Service } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
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
  onBack,
  onClose,
}: {
  clientId: string;
  template: ProjectTemplate | null;
  services: Service[];
  onBack: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: template?.name ?? "",
    description: template?.defaultDescription ?? "",
    status: "planning",
    deliveryDate: "",
    soldPrice: template?.defaultSoldPrice != null ? String(template.defaultSoldPrice) : "",
    serviceId: template?.defaultServiceId ?? "",
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
        status: form.status,
        deliveryDate: form.deliveryDate || undefined,
        soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
        templateId: template?.id,
        serviceId: form.serviceId || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    onClose();
    router.refresh();
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          <FileText size={13} />
          Using template: <strong>{template.name}</strong>
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
        <label htmlFor="ap-description" className={labelClass} style={labelStyle}>
          Description
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ap-delivery" className={labelClass} style={labelStyle}>
            Delivery date
          </label>
          <input
            id="ap-delivery"
            type="date"
            value={form.deliveryDate}
            onChange={(e) => set("deliveryDate", e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ap-status" className={labelClass} style={labelStyle}>
            Status
          </label>
          <select
            id="ap-status"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="planning">Planning</option>
            <option value="in_progress">In progress</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On hold</option>
          </select>
        </div>
        <div>
          <label htmlFor="ap-service" className={labelClass} style={labelStyle}>
            Service
          </label>
          <select
            id="ap-service"
            value={form.serviceId}
            onChange={(e) => set("serviceId", e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">— None —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
          disabled={loading || !form.title.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Creating…" : "Create Project"}
        </button>
      </div>
    </form>
  );
}

function TemplatePicker({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectTemplate | null | "clean">(undefined as unknown as ProjectTemplate | null | "clean");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/project-templates").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ])
      .then(([tplData, svcData]) => {
        setTemplates(Array.isArray(tplData) ? tplData : []);
        setServices(Array.isArray(svcData) ? svcData : []);
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
            className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors hover:border-purple-400"
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
              className="w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors hover:border-purple-400"
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
