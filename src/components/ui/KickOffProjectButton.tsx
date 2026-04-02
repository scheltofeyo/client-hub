"use client";

import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import { inputClass, inputStyle, labelClass, labelStyle } from "@/components/ui/form-styles";
import type { Project, ProjectLabel, Service } from "@/types";

export default function KickOffProjectButton({
  project,
  clientId,
}: {
  project: Project;
  clientId: string;
}) {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [form, setForm] = useState({
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
      deliveryDate,
      startDate: "",
      soldPrice,
      labelId: "",
    });
  }, [open, project.id, project.scheduledEndDate]);

  function handleOpen() {
    setError("");
    setOpen(true);
  }

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

  const serviceName =
    services.find((s) => s.id === project.serviceId)?.name ?? project.service;

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary"
      >
        <Rocket size={13} />
        Kick Off
      </button>

      <SteppedModal
        open={open}
        onClose={handleClose}
        title="Kick Off Project"
        footer={
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
              onClick={handleSubmit}
              disabled={loading || !form.deliveryDate.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
            >
              <Rocket size={13} />
              {loading ? "Kicking off…" : "Kick Off Project"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Project summary card */}
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-sidebar)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Project to kick off
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {project.title}
            </p>
            {serviceName && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {serviceName}
              </p>
            )}
            {project.description && (
              <p
                className="text-xs mt-1.5 line-clamp-3"
                style={{ color: "var(--text-muted)" }}
              >
                {project.description}
              </p>
            )}
          </div>

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
              Kicking off will activate this project and make its tasks visible
              on the client board.
            </span>
          </div>

          {/* Delivery date — most important */}
          <div>
            <label htmlFor="ko-delivery" className={labelClass} style={labelStyle}>
              Delivery date <span className="text-red-400">*</span>
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

          {/* Start date override */}
          <div>
            <label htmlFor="ko-start" className={labelClass} style={labelStyle}>
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
              Leave empty to use today. Set a past or future date to override when
              the project starts on the timeline.
            </p>
          </div>

          {/* Financial section */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Financial information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ko-price" className={labelClass} style={labelStyle}>
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
                <label htmlFor="ko-label" className={labelClass} style={labelStyle}>
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

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </SteppedModal>
    </>
  );
}
