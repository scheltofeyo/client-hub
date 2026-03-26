"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Project } from "@/types";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
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
  onClose,
}: {
  project: Project;
  clientId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: project.title,
    description: project.description ?? "",
    status: project.status,
    deliveryDate: project.deliveryDate ?? "",
    soldPrice: project.soldPrice != null ? String(project.soldPrice) : "",
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
        status: form.status,
        deliveryDate: form.deliveryDate || undefined,
        soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
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
        <label htmlFor="ep-description" className={labelClass} style={labelStyle}>
          Description
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ep-delivery" className={labelClass} style={labelStyle}>
            Delivery date
          </label>
          <input
            id="ep-delivery"
            type="date"
            value={form.deliveryDate}
            onChange={(e) => set("deliveryDate", e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
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
      </div>

      <div>
        <label htmlFor="ep-status" className={labelClass} style={labelStyle}>
          Status
        </label>
        <select
          id="ep-status"
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
}: {
  project: Project;
  clientId: string;
}) {
  const { openPanel, closePanel } = useRightPanel();

  return (
    <button
      onClick={() =>
        openPanel(
          "Edit Project",
          <EditProjectForm project={project} clientId={clientId} onClose={closePanel} />
        )
      }
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary"
    >
      <Pencil size={13} />
      Edit
    </button>
  );
}
