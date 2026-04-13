"use client";

import { useState, useEffect } from "react";
import { Plus, FileText, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { ProjectTemplate, Service } from "@/types";

/**
 * Standalone modal for creating a project.
 * Controlled externally via `open` / `onClose`.
 */
export function AddProjectModal({
  clientId,
  open,
  onClose,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    serviceId: "",
    scheduledStartDate: "",
    scheduledEndDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Reset state + fetch when modal opens
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelectedTemplate(null);
    setForm({ title: "", description: "", serviceId: "", scheduledStartDate: "", scheduledEndDate: "" });
    setError("");
    setLoading(true);
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
  }, [open]);

  function selectTemplate(tpl: ProjectTemplate | null) {
    setSelectedTemplate(tpl);
    setForm({
      title: tpl?.name ?? "",
      description: tpl?.defaultDescription ?? "",
      serviceId: tpl?.defaultServiceId ?? "",
      scheduledStartDate: "",
      scheduledEndDate: "",
    });
    setError("");
    setStep(1);
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.serviceId) return;

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/clients/${clientId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        templateId: selectedTemplate?.id,
        serviceId: form.serviceId || undefined,
        scheduledStartDate: form.scheduledStartDate || undefined,
        scheduledEndDate: form.scheduledEndDate || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const data = await res.json();

    // Store template defaults for kick-off form
    if (selectedTemplate?.defaultDeliveryDays != null || selectedTemplate?.defaultSoldPrice != null) {
      try {
        localStorage.setItem(
          `kickoff_defaults_${data.id}`,
          JSON.stringify({
            defaultDeliveryDays: selectedTemplate?.defaultDeliveryDays ?? null,
            defaultSoldPrice: selectedTemplate?.defaultSoldPrice ?? null,
          })
        );
      } catch {
        // localStorage not available
      }
    }

    onClose();
    router.push(`/clients/${clientId}/projects/${data.id}`);
  }

  const stepLabels = ["Choose a starting point", "Project details"];

  return (
    <SteppedModal
      open={open}
      onClose={onClose}
      title="New Project"
      steps={stepLabels}
      currentStep={step}
      footer={
        step === 0 ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
          >
            Cancel
          </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !form.title.trim() || !form.serviceId}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
              >
                {submitting ? "Creating…" : "Create Project"}
              </button>
            </>
          )
        }
      >
        {step === 0 ? (
          /* ── Step 1: Template picker ── */
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
                Loading templates…
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Start clean card */}
                <button
                  type="button"
                  onClick={() => selectTemplate(null)}
                  className="text-left px-4 py-4 rounded-xl border transition-all hover:border-[var(--primary)] hover:shadow-sm"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-sidebar)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      <Plus size={16} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Start clean
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Blank project — fill in everything yourself
                  </p>
                </button>

                {/* Template cards */}
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => selectTemplate(tpl)}
                    className="text-left px-4 py-4 rounded-xl border transition-all hover:border-[var(--primary)] hover:shadow-sm"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-sidebar)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--primary-light)" }}
                      >
                        <Layers size={16} style={{ color: "var(--primary)" }} />
                      </div>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {tpl.name}
                    </p>
                    {tpl.description && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                        {tpl.description}
                      </p>
                    )}
                    {(tpl.taskCount ?? 0) > 0 && (
                      <span
                        className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      >
                        {tpl.taskCount} task{tpl.taskCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!loading && templates.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No templates yet. An admin can create them in the Admin panel.
              </p>
            )}
          </div>
        ) : (
          /* ── Step 2: Project details ── */
          <div className="space-y-5">
            {selectedTemplate && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <FileText size={13} className="mt-0.5 shrink-0" />
                <div>
                  <span>Using template: <strong>{selectedTemplate.name}</strong></span>
                  {(selectedTemplate.taskCount ?? 0) > 0 && (
                    <p className="text-xs mt-0.5 opacity-75">
                      {selectedTemplate.taskCount} task{selectedTemplate.taskCount === 1 ? "" : "s"} will be added automatically
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="ap-title" className="typo-label">
                Title <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="ap-title"
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Website Redesign"
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <ServicePills
              services={services}
              selectedId={form.serviceId}
              onChange={(id) => set("serviceId", id)}
              label="Connect to a service"
              required
            />

            <div>
              <label htmlFor="ap-description" className="typo-label">
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

            <div>
              <p
                className="typo-section-header mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Scheduled dates
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ap-start" className="typo-label">
                    Start date
                  </label>
                  <input
                    id="ap-start"
                    type="date"
                    value={form.scheduledStartDate}
                    onChange={(e) => set("scheduledStartDate", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="ap-end" className="typo-label">
                    End date
                  </label>
                  <input
                    id="ap-end"
                    type="date"
                    value={form.scheduledEndDate}
                    onChange={(e) => set("scheduledEndDate", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Shown on the timeline. End date pre-fills delivery date at kick-off.
              </p>
            </div>

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </SteppedModal>
  );
}

/**
 * Button + modal combo for the common case. Renders its own trigger button.
 */
export default function AddProjectButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
      >
        <Plus size={13} />
        Add Project
      </button>
      <AddProjectModal clientId={clientId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
