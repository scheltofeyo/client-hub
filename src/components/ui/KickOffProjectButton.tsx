"use client";

import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { Project, ProjectLabel, Service } from "@/types";

export default function KickOffProjectButton({
  project,
  clientId,
}: {
  project: Project;
  clientId: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    serviceId: "",
    deliveryDate: "",
    startDate: "",
    soldPrice: "",
    labelId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Fetch services + labels when modal opens
  useEffect(() => {
    if (!open) return;

    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/project-labels").then((r) => r.json()),
    ])
      .then(([svcData, lblData]) => {
        setServices(Array.isArray(svcData) ? svcData : []);
        setLabels(Array.isArray(lblData) ? lblData : []);
      })
      .catch(() => {});
  }, [open]);

  function handleClose() {
    setOpen(false);
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.deliveryDate.trim()) return;

    setLoading(true);
    setError("");

    const res = await fetch(
      `/api/clients/${clientId}/projects/${project.id}/kickoff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: form.deliveryDate,
          title: form.title !== project.title ? form.title : undefined,
          description: form.description !== (project.description ?? "") ? form.description : undefined,
          serviceId: form.serviceId !== project.serviceId ? form.serviceId : undefined,
          soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
          labelId: form.labelId || undefined,
          kickedOffAt: form.startDate || undefined,
        }),
      }
    );

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    try {
      localStorage.removeItem(`kickoff_defaults_${project.id}`);
    } catch {
      // ignore
    }

    handleClose();
    router.refresh();
  }

  const stepLabels = ["Review details", "Dates", "Financials"];

  const canAdvanceFromStep0 = form.title.trim() && form.serviceId;
  const canAdvanceFromStep1 = form.deliveryDate.trim();

  function footer() {
    if (step === 0) {
      return (
        <>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={!canAdvanceFromStep0}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
          >
            Next
          </button>
        </>
      );
    }
    if (step === 1) {
      return (
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
            onClick={() => setStep(2)}
            disabled={!canAdvanceFromStep1}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
          >
            Next
          </button>
        </>
      );
    }
    // step === 2
    return (
      <>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !canAdvanceFromStep1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          <Rocket size={13} />
          {loading ? "Kicking off…" : "Kick Off Project"}
        </button>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setStep(0);
          setError("");

          // Pre-fill from template defaults
          let deliveryDate = "";
          let soldPrice = "";
          try {
            const raw = localStorage.getItem(`kickoff_defaults_${project.id}`);
            if (raw) {
              const defaults = JSON.parse(raw) as {
                defaultDeliveryDays?: number | null;
                defaultSoldPrice?: number | null;
              };
              if (defaults.defaultDeliveryDays) {
                const d = new Date();
                d.setDate(d.getDate() + defaults.defaultDeliveryDays);
                deliveryDate = d.toISOString().slice(0, 10);
              }
              if (defaults.defaultSoldPrice != null) {
                soldPrice = String(defaults.defaultSoldPrice);
              }
            }
          } catch {
            // localStorage not available
          }

          // Fall back to scheduled end date
          if (!deliveryDate && project.scheduledEndDate) {
            deliveryDate = project.scheduledEndDate;
          }

          setForm({
            title: project.title,
            description: project.description ?? "",
            serviceId: project.serviceId ?? "",
            deliveryDate,
            startDate: "",
            soldPrice,
            labelId: "",
          });
          setOpen(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
      >
        <Rocket size={13} />
        Kick Off
      </button>

      <SteppedModal
        open={open}
        onClose={handleClose}
        title="Kick Off Project"
        steps={stepLabels}
        currentStep={step}
        footer={footer()}
      >
        {/* ── Step 1: Review project details ── */}
        {step === 0 && (
          <div className="space-y-5">
            {/* Info banner */}
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
              }}
            >
              <Rocket size={13} className="mt-0.5 shrink-0" />
              <span>
                Review and adjust the project details before kicking off.
              </span>
            </div>

            <div>
              <label htmlFor="ko-title" className="typo-label">
                Title <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="ko-title"
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <ServicePills
              services={services}
              selectedId={form.serviceId}
              onChange={(id) => set("serviceId", id)}
              label="Service"
              required
            />

            <div>
              <label htmlFor="ko-description" className="typo-label">
                Description
              </label>
              <textarea
                id="ko-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Describe the project scope…"
                className={inputClass + " resize-none"}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Dates ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label htmlFor="ko-delivery" className="typo-label">
                Delivery date <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="ko-delivery"
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

            <div>
              <label htmlFor="ko-start" className="typo-label">
                Start date override
              </label>
              <input
                id="ko-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Leave empty to use today. Set a past or future date to override
                when the project starts on the timeline.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Financials ── */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Financial details are optional — you can always add them later.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ko-price" className="typo-label">
                  Sold price (€)
                </label>
                <input
                  id="ko-price"
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
                <label htmlFor="ko-label" className="typo-label">
                  Label
                </label>
                <select
                  id="ko-label"
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

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </SteppedModal>
    </>
  );
}
