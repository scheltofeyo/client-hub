"use client";

import { useState } from "react";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import RichTextEditor from "@/components/ui/RichTextEditor";
import UserAvatar from "@/components/ui/UserAvatar";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { Project, ProjectLabel, Service, TaskAssignee } from "@/types";

type AssignableUser = { id: string; name: string; image: string | null };

export default function EditProjectButton({
  project,
  clientId,
  services,
  labels,
  canDelete = false,
  canReset = false,
}: {
  project: Project;
  clientId: string;
  services: Service[];
  labels: ProjectLabel[];
  canDelete?: boolean;
  canReset?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    completedDate: "",
    deliveryDate: "",
    soldPrice: "",
    serviceId: "",
    labelId: "",
    scheduledStartDate: "",
    scheduledEndDate: "",
    kickedOffAt: "",
  });
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function handleOpen() {
    setForm({
      title: project.title,
      description: project.description ?? "",
      completedDate: project.completedDate ?? "",
      deliveryDate: project.deliveryDate ?? "",
      soldPrice: project.soldPrice != null ? String(project.soldPrice) : "",
      serviceId: project.serviceId ?? "",
      labelId: project.labelId ?? "",
      scheduledStartDate: project.scheduledStartDate ?? "",
      scheduledEndDate: project.scheduledEndDate ?? "",
      kickedOffAt: project.kickedOffAt ?? "",
    });
    setSelectedMembers(project.members ?? []);
    setError("");
    setOpen(true);
    if (users.length === 0) {
      setUsersLoading(true);
      fetch("/api/users/assignable")
        .then((r) => r.json())
        .then((data) => {
          setUsers(Array.isArray(data) ? data : []);
        })
        .finally(() => setUsersLoading(false));
    }
  }

  function toggleMember(u: AssignableUser) {
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.userId === u.id)) {
        return prev.filter((m) => m.userId !== u.id);
      }
      return [...prev, { userId: u.id, name: u.name, image: u.image ?? undefined }];
    });
  }

  function handleClose() {
    setOpen(false);
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        ...(project.status === "completed"
          ? { completedDate: form.completedDate || undefined }
          : {}),
        deliveryDate: form.deliveryDate || undefined,
        soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
        serviceId: form.serviceId || undefined,
        labelId: form.labelId || undefined,
        members: selectedMembers.map((m) => ({ userId: m.userId })),
        ...(!project.kickedOffAt
          ? {
              scheduledStartDate: form.scheduledStartDate || undefined,
              scheduledEndDate: form.scheduledEndDate || undefined,
            }
          : {
              kickedOffAt: form.kickedOffAt || undefined,
            }),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    handleClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete project "${project.title}"? This cannot be undone.`))
      return;

    setDeleting(true);
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "DELETE",
    });
    setDeleting(false);

    if (!res.ok) {
      setError("Failed to delete project");
      return;
    }

    handleClose();
    router.push(`/clients/${clientId}?tab=projects`);
    router.refresh();
  }

  async function handleReset() {
    if (
      !confirm(
        `Reset "${project.title}" to upcoming? This will clear the delivery date, financials, and project status.`
      )
    )
      return;

    setResetting(true);
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kickedOffAt: null }),
    });
    setResetting(false);

    if (!res.ok) {
      setError("Failed to reset project");
      return;
    }

    handleClose();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-border"
      >
        <Pencil size={13} />
        Edit
      </button>

      <SteppedModal
        open={open}
        onClose={handleClose}
        title="Edit Project"
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
              disabled={loading || !form.title.trim() || !form.serviceId}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
            >
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Core fields */}
          <div>
            <label htmlFor="ep-title" className="typo-label">
              Title <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="ep-title"
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
            label="Connect to a service"
            required
          />

          <div>
            <label className="typo-label">
              Description
            </label>
            <RichTextEditor
              content={form.description}
              onChange={(html) => set("description", html)}
            />
          </div>

          <div>
            <label className="typo-label">Project members</label>
            {usersLoading && users.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Loading members…
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {users.map((u) => {
                  const isActive = selectedMembers.some((m) => m.userId === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u)}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        borderColor: isActive ? "var(--primary)" : "var(--border)",
                        color: isActive ? "var(--primary)" : "var(--text-muted)",
                        background: isActive ? "var(--primary-light)" : "transparent",
                      }}
                    >
                      <UserAvatar name={u.name} image={u.image} size={18} />
                      {u.name.split(" ")[0]}
                      {isActive && <span style={{ color: "var(--primary)" }}>×</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              Editing members updates the project only. Existing task assignees are not changed.
            </p>
          </div>

          {/* Scheduled dates — before kick-off */}
          {!project.kickedOffAt && (
            <div className="!mt-9">
              <p
                className="typo-section-header mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Scheduled dates
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ep-sched-start" className="typo-label">
                    Start date
                  </label>
                  <input
                    id="ep-sched-start"
                    type="date"
                    value={form.scheduledStartDate}
                    onChange={(e) => set("scheduledStartDate", e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="ep-sched-end" className="typo-label">
                    End date
                  </label>
                  <input
                    id="ep-sched-end"
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
          )}

          {/* Completed date */}
          {project.status === "completed" && (
            <div>
              <label htmlFor="ep-completed-date" className="typo-label">
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

          {/* Project dates + financial — after kick-off */}
          {project.kickedOffAt && (
            <>
              <div className="!mt-9">
                <p
                  className="typo-section-header mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Project dates
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ep-kickoff" className="typo-label">
                      Kick-off date
                    </label>
                    <input
                      id="ep-kickoff"
                      type="date"
                      value={form.kickedOffAt}
                      onChange={(e) => set("kickedOffAt", e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="ep-delivery" className="typo-label">
                      Expected delivery
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
                </div>
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  Delivery date automatically creates a timeline event.
                </p>
              </div>

              <div className="!mt-9">
                <p
                  className="typo-section-header mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Financial information
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ep-price" className="typo-label">
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
                  <div>
                    <label htmlFor="ep-label" className="typo-label">
                      Label
                    </label>
                    <select
                      id="ep-label"
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
            </>
          )}

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          {/* Danger zone */}
          {(canDelete || canReset) && (
            <div
              className="pt-5 mt-5 border-t space-y-2"
              style={{ borderColor: "var(--border)" }}
            >
              <p
                className="typo-section-header mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Danger zone
              </p>
              {canReset && project.kickedOffAt && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-border border"
                >
                  <RotateCcw size={13} />
                  {resetting ? "Resetting…" : "Reset to upcoming"}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-danger"
                >
                  <Trash2 size={13} />
                  {deleting ? "Deleting…" : "Delete project"}
                </button>
              )}
            </div>
          )}
        </div>
      </SteppedModal>
    </>
  );
}
