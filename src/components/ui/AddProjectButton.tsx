"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, FileText, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import SteppedModal from "@/components/ui/SteppedModal";
import ServicePills from "@/components/ui/ServicePills";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import { SummaryRow, SummarySection } from "@/components/ui/summary-blocks";
import UserAvatar from "@/components/ui/UserAvatar";
import Toggle from "@/components/ui/Toggle";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { ProjectLabel, ProjectTemplate, Service, TaskAssignee } from "@/types";

type AssignableUser = { id: string; name: string; image: string | null };

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

/** Tiptap emits "<p></p>" for an empty document */
function isEmptyHtml(html: string) {
  return !html.replace(/<[^>]*>/g, "").trim();
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
function fmtDay(s: string) {
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? s : dayFmt.format(d);
}

const NO_EDITS = {
  title: false,
  service: false,
  description: false,
  members: false,
  timeline: false,
  completed: false,
  price: false,
  label: false,
};

/**
 * Standalone modal for creating a project.
 * Controlled externally via `open` / `onClose`.
 *
 * In plan-draft mode (`planId` is set), the modal short-circuits after the
 * template pick: it POSTs to the plan's drafts endpoint, calls
 * `onDraftCreated` with the response, and closes. Step 2 (project details)
 * and the redirect to the project page are skipped.
 */
export function AddProjectModal({
  clientId,
  open,
  onClose,
  planId,
  onDraftCreated,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
  planId?: string;
  onDraftCreated?: (result: { project: Record<string, unknown>; tasks: unknown[]; sessions: unknown[] }) => void;
}) {
  const isPlanDraftMode = !!planId;
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<TaskAssignee[]>([]);
  const [addAsCompleted, setAddAsCompleted] = useState(false);
  const [editing, setEditing] = useState(NO_EDITS);
  // Service-first picker: which service's templates are shown on step 1.
  // `null` = haven't picked yet; "__ungrouped__" = pick from templates without a service.
  const UNGROUPED_KEY = "__ungrouped__";
  const [pickerServiceId, setPickerServiceId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    serviceId: "",
    scheduledStartDate: "",
    scheduledEndDate: "",
    completedDate: "",
    soldPrice: "",
    labelId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Reset state + fetch when modal opens
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setStep(0);
      setSelectedTemplate(null);
      setSelectedMembers([]);
      setAddAsCompleted(false);
      setEditing(NO_EDITS);
      setPickerServiceId(null);
      setForm({
        title: "",
        description: "",
        serviceId: "",
        scheduledStartDate: "",
        scheduledEndDate: "",
        completedDate: "",
        soldPrice: "",
        labelId: "",
      });
      setError("");
      setLoading(true);
    });
    Promise.all([
      fetch("/api/project-templates").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/users/assignable").then((r) => r.json()),
      fetch("/api/project-labels").then((r) => r.json()),
    ])
      .then(([tplData, svcData, userData, lblData]) => {
        setTemplates(Array.isArray(tplData) ? tplData : []);
        setServices(Array.isArray(svcData) ? svcData : []);
        setUsers(Array.isArray(userData) ? userData : []);
        setLabels(Array.isArray(lblData) ? lblData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open]);

  function toggleMember(u: AssignableUser) {
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.userId === u.id)) {
        return prev.filter((m) => m.userId !== u.id);
      }
      return [...prev, { userId: u.id, name: u.name, image: u.image ?? undefined }];
    });
  }

  function selectTemplate(tpl: ProjectTemplate | null) {
    setSelectedTemplate(tpl);
    setAddAsCompleted(false);
    setEditing(NO_EDITS);

    if (isPlanDraftMode) {
      submitDraft(tpl);
      return;
    }

    // When picking a template, prefer its defaultServiceId; otherwise use the
    // service the user picked in step 0 (real service id only — Ungrouped acts
    // like a no-service starting point).
    const serviceId =
      tpl?.defaultServiceId ??
      (pickerServiceId && pickerServiceId !== UNGROUPED_KEY ? pickerServiceId : "");
    setForm({
      title: tpl?.name ?? "",
      description: tpl?.defaultDescription ?? "",
      serviceId,
      scheduledStartDate: "",
      scheduledEndDate: "",
      completedDate: "",
      soldPrice: tpl?.defaultSoldPrice != null ? String(tpl.defaultSoldPrice) : "",
      labelId: "",
    });
    setError("");
    setStep(2);
  }

  async function submitDraft(tpl: ProjectTemplate | null) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const body = tpl
        ? { templateId: tpl.id }
        : { title: "New draft" };
      const res = await fetch(`/api/clients/${clientId}/plans/${planId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to add draft");
        return;
      }
      const data = await res.json();
      const { tasks = [], sessions = [], ...projectData } = data;
      onDraftCreated?.({ project: projectData, tasks, sessions });
      onClose();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.serviceId) return;
    if (addAsCompleted && !form.completedDate.trim()) return;

    setSubmitting(true);
    setError("");

    const baseBody: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      templateId: selectedTemplate?.id,
      serviceId: form.serviceId || undefined,
      members: selectedMembers.map((m) => ({ userId: m.userId })),
    };

    const body = addAsCompleted
      ? {
          ...baseBody,
          addAsCompleted: true,
          completedDate: form.completedDate,
          soldPrice: form.soldPrice ? Number(form.soldPrice) : undefined,
          labelId: form.labelId || undefined,
        }
      : {
          ...baseBody,
          scheduledStartDate: form.scheduledStartDate || undefined,
          scheduledEndDate: form.scheduledEndDate || undefined,
        };

    const res = await fetch(`/api/clients/${clientId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const data = await res.json();

    // Store template defaults for kick-off form (skip when project is already completed)
    if (
      !addAsCompleted &&
      (selectedTemplate?.defaultDeliveryDays != null || selectedTemplate?.defaultSoldPrice != null)
    ) {
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

  const stepLabels = isPlanDraftMode
    ? ["Choose service", "Choose template"]
    : ["Choose service", "Choose template", "Project details"];

  // Group templates by service for the picker. Group order follows `services`
  // (rank-sorted by the API); only services with at least one template show up.
  // Ungrouped (no defaultServiceId) is added last when present.
  const templateGroups = useMemo(() => {
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

  const templatesForPickedService = useMemo(() => {
    if (!pickerServiceId) return [] as ProjectTemplate[];
    return templateGroups.find((g) => g.id === pickerServiceId)?.items ?? [];
  }, [pickerServiceId, templateGroups]);

  const pickedServiceName = useMemo(() => {
    if (!pickerServiceId) return null;
    if (pickerServiceId === UNGROUPED_KEY) return "Ungrouped";
    return services.find((s) => s.id === pickerServiceId)?.name ?? null;
  }, [pickerServiceId, services]);

  // ── Step 2 (review) derived values ──
  const titleInvalid = !form.title.trim();
  const serviceInvalid = !form.serviceId;
  const completedInvalid = addAsCompleted && !form.completedDate.trim();
  const serviceName = services.find((s) => s.id === form.serviceId)?.name ?? "—";
  const labelName = form.labelId
    ? (labels.find((l) => l.id === form.labelId)?.name ?? "—")
    : "No label";
  const templateContentRows = selectedTemplate
    ? [
        { key: "why", label: "Why", html: selectedTemplate.defaultWhy },
        { key: "what", label: "What", html: selectedTemplate.defaultWhat },
        { key: "how", label: "How", html: selectedTemplate.defaultHow },
        { key: "activities", label: "Activities", html: selectedTemplate.defaultActivities },
        { key: "deliverables", label: "Deliverables", html: selectedTemplate.defaultDeliverables },
      ].filter(
        (r): r is { key: string; label: string; html: string } =>
          !!r.html && !isEmptyHtml(r.html)
      )
    : [];
  const inheritedPrice =
    !addAsCompleted &&
    selectedTemplate?.effectivePrice != null &&
    selectedTemplate.effectivePrice > 0
      ? selectedTemplate.effectivePrice
      : null;
  const scheduledLabel =
    form.scheduledStartDate || form.scheduledEndDate
      ? `${form.scheduledStartDate ? fmtDay(form.scheduledStartDate) : "Not set"} → ${
          form.scheduledEndDate ? fmtDay(form.scheduledEndDate) : "Not set"
        }`
      : "Not scheduled";

  return (
    <SteppedModal
      open={open}
      onClose={onClose}
      title={isPlanDraftMode ? "Add draft project" : "New Project"}
      steps={stepLabels}
      currentStep={step}
      onStepClick={(i) => {
        if (i === 0) {
          setPickerServiceId(null);
          setStep(0);
          return;
        }
        // Step 1 needs a picked service; fall back to the picker otherwise
        if (i === 1 && !pickerServiceId) {
          setStep(0);
          return;
        }
        setStep(i);
      }}
      footerLeft={
        step === 0 ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
          >
            Cancel
          </button>
        ) : step === 1 ? (
          <button
            type="button"
            onClick={() => {
              setPickerServiceId(null);
              setStep(0);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep(pickerServiceId ? 1 : 0)}
            className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost"
          >
            Back
          </button>
        )
      }
      footer={
        step === 2 ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !form.title.trim() ||
              !form.serviceId ||
              (addAsCompleted && !form.completedDate.trim())
            }
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
          >
            {submitting
              ? "Creating…"
              : addAsCompleted
              ? "Create completed project"
              : "Create Project"}
          </button>
        ) : null
      }
    >
        {step === 0 ? (
          /* ── Step 0: Service picker ── */
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
                Loading…
              </p>
            ) : (
              <div className="space-y-3">
                {/* Start clean — full-width row, highlights the blank path */}
                <button
                  type="button"
                  onClick={() => selectTemplate(null)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all hover:border-[var(--primary)] hover:shadow-sm text-left"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-sidebar)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <Plus size={16} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      Start clean
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Blank project — fill in everything yourself
                    </p>
                  </div>
                </button>

                {/* Service cards (only services that have templates) */}
                <div className="grid grid-cols-2 gap-3">
                  {templateGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setPickerServiceId(group.id);
                        setStep(1);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:border-[var(--primary)] hover:shadow-sm text-left"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--bg-sidebar)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "var(--primary-light)" }}
                      >
                        <FolderOpen size={16} style={{ color: "var(--primary)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {group.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {group.items.length} template{group.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && templateGroups.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No templates yet. Use &ldquo;Start clean&rdquo; above or create templates in the Admin panel.
              </p>
            )}
          </div>
        ) : step === 1 ? (
          /* ── Step 1: Template picker (filtered by selected service) ── */
          <div className="space-y-3">
            {pickedServiceName && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Service: <span style={{ color: "var(--text-primary)" }}>{pickedServiceName}</span>
              </p>
            )}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* "Use this service without a template" — only for real services */}
              {pickerServiceId && pickerServiceId !== UNGROUPED_KEY && (
                <button
                  type="button"
                  onClick={() => selectTemplate(null)}
                  className="flex items-start justify-between gap-4 w-full px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      No template
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Start blank with this service
                    </p>
                  </div>
                </button>
              )}

              {templatesForPickedService.map((tpl, idx) => {
                const isLast = idx === templatesForPickedService.length - 1;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => selectTemplate(tpl)}
                    className="flex items-start justify-between gap-4 w-full px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                    style={isLast ? undefined : { borderBottom: "1px solid var(--border)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {tpl.name}
                      </p>
                      {tpl.summary && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          {tpl.summary}
                        </p>
                      )}
                    </div>
                    {tpl.effectivePrice != null && tpl.effectivePrice > 0 && (
                      <span
                        className="shrink-0 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium tabular-nums"
                        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      >
                        {formatEuro(tpl.effectivePrice)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── Step 2: Review ── */
          <div className="space-y-5">
            {selectedTemplate && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <FileText size={13} className="mt-0.5 shrink-0" />
                <div>
                  <span>Using template: <strong>{selectedTemplate.name}</strong></span>
                  {selectedTemplate.summary && (
                    <p className="text-xs mt-0.5 opacity-90">
                      {selectedTemplate.summary}
                    </p>
                  )}
                  {(selectedTemplate.taskCount ?? 0) > 0 && (
                    <p className="text-xs mt-0.5 opacity-75">
                      {selectedTemplate.taskCount} task{selectedTemplate.taskCount === 1 ? "" : "s"} will be added automatically
                    </p>
                  )}
                </div>
              </div>
            )}

            <div
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: "var(--primary-light)" }}
            >
              <Toggle
                checked={addAsCompleted}
                onChange={() => setAddAsCompleted((v) => !v)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                  Add as completed project
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Skip kick-off and mark all tasks as done.
                </p>
              </div>
            </div>

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
                    label="Connect to a service"
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
              <SummaryRow
                label="Members"
                value={
                  selectedMembers.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {selectedMembers.map((m) => (
                        <UserAvatar key={m.userId} name={m.name} image={m.image ?? null} size={22} />
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>No members</span>
                  )
                }
                editing={editing.members}
                onEdit={() => setEditing((e) => ({ ...e, members: true }))}
                onDone={() => setEditing((e) => ({ ...e, members: false }))}
                editor={
                  <div>
                    <label className="typo-label">Project members</label>
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
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                      {selectedTemplate
                        ? "These members will be assigned to every task created from this template."
                        : "Members are saved on the project. Tasks you add later are not auto-assigned."}
                    </p>
                  </div>
                }
              />
            </SummarySection>

            {templateContentRows.length > 0 && (
              <SummarySection title="From template">
                {templateContentRows.map((row) => (
                  <SummaryRow
                    key={row.key}
                    label={row.label}
                    value={<RichTextDisplay html={row.html} className="line-clamp-3 text-sm" />}
                    caption={
                      row.key === templateContentRows[templateContentRows.length - 1].key
                        ? "From template · edit later in the project"
                        : undefined
                    }
                  />
                ))}
              </SummarySection>
            )}

            <SummarySection title="Schedule & budget">
              {addAsCompleted ? (
                <>
                  <SummaryRow
                    label="Completed"
                    value={form.completedDate ? fmtDay(form.completedDate) : "—"}
                    warning={completedInvalid ? "Completed date is required" : undefined}
                    editing={editing.completed || completedInvalid}
                    onEdit={() => setEditing((e) => ({ ...e, completed: true }))}
                    onDone={() => setEditing((e) => ({ ...e, completed: false }))}
                    editor={
                      <div>
                        <label htmlFor="ap-completed" className="typo-label">
                          Completed date <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          id="ap-completed"
                          type="date"
                          value={form.completedDate}
                          onChange={(e) => set("completedDate", e.target.value)}
                          className={inputClass}
                          style={inputStyle}
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          Used as kick-off, delivery and completion date.
                        </p>
                      </div>
                    }
                  />
                  <SummaryRow
                    label="Sold price"
                    value={form.soldPrice ? formatEuro(Number(form.soldPrice)) : "—"}
                    editing={editing.price}
                    onEdit={() => setEditing((e) => ({ ...e, price: true }))}
                    onDone={() => setEditing((e) => ({ ...e, price: false }))}
                    editor={
                      <div>
                        <label htmlFor="ap-price" className="typo-label">
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
                    }
                  />
                  <SummaryRow
                    label="Label"
                    value={labelName}
                    editing={editing.label}
                    onEdit={() => setEditing((e) => ({ ...e, label: true }))}
                    onDone={() => setEditing((e) => ({ ...e, label: false }))}
                    editor={
                      <div>
                        <label htmlFor="ap-label" className="typo-label">
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
                    }
                  />
                </>
              ) : (
                <>
                  <SummaryRow
                    label="Timeline"
                    value={scheduledLabel}
                    editing={editing.timeline}
                    onEdit={() => setEditing((e) => ({ ...e, timeline: true }))}
                    onDone={() => setEditing((e) => ({ ...e, timeline: false }))}
                    editor={
                      <div>
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
                    }
                  />
                  {inheritedPrice != null && (
                    <SummaryRow
                      label="Price"
                      value={formatEuro(inheritedPrice)}
                      caption="From template · finalised at kick-off"
                    />
                  )}
                </>
              )}
            </SummarySection>

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
