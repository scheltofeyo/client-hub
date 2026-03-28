"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Project, Service } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

function EditProjectForm({
  project,
  clientId,
  services,
  onClose,
}: {
  project: Project;
  clientId: string;
  services: Service[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: project.title,
    description: project.description ?? "",
    completedDate: project.completedDate ?? "",
    soldPrice: project.soldPrice != null ? String(project.soldPrice) : "",
    serviceId: project.serviceId ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        ...(project.status === "completed" ? { completedDate: form.completedDate || undefined } : {}),
        soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
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

  async function handleDelete() {
    if (!confirm(`Delete project "${project.title}"? This cannot be undone.`)) return;

    setDeleting(true);
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "DELETE",
    });
    setDeleting(false);

    if (!res.ok) {
      setError("Failed to delete project");
      return;
    }

    onClose();
    router.push(`/clients/${clientId}?tab=projects`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ep-title" className={labelClass} style={labelStyle}>
          Title <span className="text-red-400">*</span>
        </label>
        <input
          id="ep-title"
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          autoFocus
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="ep-service" className={labelClass} style={labelStyle}>
          Connect to a service <span className="text-red-400">*</span>
        </label>
        <select
          id="ep-service"
          value={form.serviceId}
          onChange={(e) => set("serviceId", e.target.value)}
          required
          className={inputClass}
          style={inputStyle}
        >
          <option value="">— Select a service —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ep-description" className={labelClass} style={labelStyle}>
          Short description
        </label>
        <textarea
          id="ep-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      {project.status === "completed" && (
        <div>
          <label htmlFor="ep-completed-date" className={labelClass} style={labelStyle}>
            Completed date
          </label>
          <input
            id="ep-completed-date"
            type="date"
            value={form.completedDate}
            onChange={(e) => set("completedDate", e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}

      <div>
        <label htmlFor="ep-price" className={labelClass} style={labelStyle}>
          Sold price (€)
        </label>
        <input
          id="ep-price"
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
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Danger zone */}
      <div
        className="pt-4 mt-4 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Danger zone
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-danger"
        >
          <Trash2 size={13} />
          {deleting ? "Deleting…" : "Delete project"}
        </button>
      </div>
    </form>
  );
}

export default function EditProjectButton({
  project,
  clientId,
  services,
}: {
  project: Project;
  clientId: string;
  services: Service[];
}) {
  const { openPanel, closePanel } = useRightPanel();

  return (
    <button
      onClick={() =>
        openPanel(
          "Edit Project",
          <EditProjectForm
            project={project}
            clientId={clientId}
            services={services}
            onClose={closePanel}
          />
        )
      }
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
    >
      <Pencil size={13} />
      Edit
    </button>
  );
}
