"use client";

import { useState, useEffect, useRef } from "react";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import { SummaryRow, SummarySection } from "@/components/ui/summary-blocks";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import { formatEuro } from "@/lib/proposal-format";
import { discountAmountFor, netPriceFor } from "@/lib/pricing";
import type { Project, ProjectLabel, Service } from "@/types";

/** Tiptap emits "<p></p>" for an empty document */
function isEmptyHtml(html: string) {
  return !html.replace(/<[^>]*>/g, "").trim();
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmtDay(s: string) {
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? s : dayFmt.format(d);
}

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
  const [editing, setEditing] = useState({ title: false, service: false, description: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const staleRef = useRef(false);
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
    if (staleRef.current) {
      staleRef.current = false;
      router.refresh();
    }
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.deliveryDate.trim()) return;

    setLoading(true);
    setError("");

    // Only send fields that differ from the project — an absent key keeps the
    // existing value, "" actively clears it (route maps "" to null).
    const res = await fetch(
      `/api/clients/${clientId}/projects/${project.id}/kickoff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: form.deliveryDate,
          title: form.title !== project.title ? form.title : undefined,
          description: form.description !== (project.description ?? "") ? form.description : undefined,
          serviceId: form.serviceId !== (project.serviceId ?? "") ? form.serviceId : undefined,
          soldPrice:
            form.soldPrice !== (project.soldPrice != null ? String(project.soldPrice) : "")
              ? form.soldPrice
                ? Number(form.soldPrice)
                : null
              : undefined,
          labelId: form.labelId !== (project.labelId ?? "") ? form.labelId : undefined,
          kickedOffAt: form.startDate || undefined,
        }),
      }
    );

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      if (res.status === 409) staleRef.current = true;
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

  const stepLabels = ["Plan", "Final check"];

  const titleInvalid = !form.title.trim();
  const serviceInvalid = !form.serviceId;
  const canAdvanceFromStep0 = !!form.deliveryDate.trim();
  const canKickOff = canAdvanceFromStep0 && !titleInvalid && !serviceInvalid;

  const serviceName =
    services.find((s) => s.id === form.serviceId)?.name ?? project.service ?? "—";
  // Discount is set in the plan editor, not at kickoff — derive the live net
  // from whatever gross price is currently in the form.
  const formGross = form.soldPrice ? Number(form.soldPrice) : 0;
  const formDiscount = discountAmountFor(formGross, project.discountType, project.discountValue);
  const formNet = netPriceFor(formGross, project.discountType, project.discountValue);
  const labelName = form.labelId
    ? labels.find((l) => l.id === form.labelId)?.name ?? project.label ?? "—"
    : "No label";

  function footerLeft() {
    if (step === 0) {
      return (
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
        >
          Cancel
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setStep(0)}
        className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
      >
        Back
      </button>
    );
  }

  function footer() {
    if (step === 0) {
      return (
        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={!canAdvanceFromStep0}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          Next
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !canKickOff}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
      >
        <Rocket size={13} />
        {loading ? "Kicking off…" : "Kick Off Project"}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setStep(0);
          setError("");
          setEditing({ title: false, service: false, description: false });

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

          // Fall back to the project's own price (e.g. set in a project plan)
          if (!soldPrice && project.soldPrice != null) {
            soldPrice = String(project.soldPrice);
          }

          setForm({
            title: project.title,
            description: project.description ?? "",
            serviceId: project.serviceId ?? "",
            deliveryDate,
            startDate: project.scheduledStartDate ?? "",
            soldPrice,
            labelId: project.labelId ?? "",
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
        onStepClick={(i) => setStep(i)}
        footerLeft={footerLeft()}
        footer={footer()}
      >
        {/* ── Step 1: Plan ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="typo-caption">Kicking off</p>
              <p className="typo-modal-title" style={{ color: "var(--text-primary)" }}>
                {project.title}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ko-start" className="typo-label">
                  Start date
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
                  Leave empty to start today.
                </p>
              </div>
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
            </div>

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
                {project.soldPrice != null && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Agreed in project plan: {formatEuro(project.soldPrice)}
                  </p>
                )}
                {formDiscount > 0 && (
                  <p className="text-xs mt-1 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    Discount{project.discountType === "percentage" ? ` (${project.discountValue}%)` : ""}: − {formatEuro(formDiscount)} · Net: {formatEuro(formNet)}
                  </p>
                )}
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
          </div>
        )}

        {/* ── Step 2: Final check ── */}
        {step === 1 && (
          <div className="space-y-5">
            <SummarySection title="Project details">
              <SummaryRow
                label="Title"
                value={form.title}
                warning={titleInvalid ? "Title is required" : undefined}
                editing={editing.title || titleInvalid}
                onEdit={() => setEditing((e) => ({ ...e, title: true }))}
                onDone={() => setEditing((e) => ({ ...e, title: false }))}
                editor={
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
                }
              />
              <SummaryRow
                label="Service"
                value={serviceName}
                warning={serviceInvalid ? "Select a service" : undefined}
                editing={editing.service || serviceInvalid}
                onEdit={() => setEditing((e) => ({ ...e, service: true }))}
                onDone={() => setEditing((e) => ({ ...e, service: false }))}
                editor={
                  <ServicePills
                    services={services}
                    selectedId={form.serviceId}
                    onChange={(id) => set("serviceId", id)}
                    label="Service"
                    required
                  />
                }
              />
              <SummaryRow
                label="Description"
                value={
                  isEmptyHtml(form.description) ? (
                    <span style={{ color: "var(--text-muted)" }}>No description</span>
                  ) : (
                    <RichTextDisplay html={form.description} className="line-clamp-4 text-sm" />
                  )
                }
                editing={editing.description}
                onEdit={() => setEditing((e) => ({ ...e, description: true }))}
                onDone={() => setEditing((e) => ({ ...e, description: false }))}
                editor={
                  <div>
                    <label className="typo-label">Description</label>
                    <RichTextEditor
                      content={form.description}
                      onChange={(html) => set("description", html)}
                      placeholder="Describe the project scope…"
                    />
                  </div>
                }
              />
            </SummarySection>

            <SummarySection title="Plan">
              <SummaryRow
                label="Timeline"
                value={`${form.startDate ? fmtDay(form.startDate) : "Today"} → ${fmtDay(form.deliveryDate)}`}
                onEdit={() => setStep(0)}
              />
              <SummaryRow
                label="Price"
                value={
                  form.soldPrice
                    ? formDiscount > 0
                      ? (
                          <>
                            <span className="line-through mr-1.5" style={{ color: "var(--text-muted)" }}>
                              {formatEuro(formGross)}
                            </span>
                            {formatEuro(formNet)}
                          </>
                        )
                      : formatEuro(formGross)
                    : "—"
                }
                onEdit={() => setStep(0)}
              />
              <SummaryRow label="Label" value={labelName} onEdit={() => setStep(0)} />
            </SummarySection>

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </SteppedModal>
    </>
  );
}
