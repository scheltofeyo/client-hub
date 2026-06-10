"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, X, Send, ExternalLink, MoreHorizontal, Link as LinkIcon, Download, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRightPanel } from "@/components/layout/RightPanel";
import { usePermission } from "@/hooks/usePermission";
import RichTextEditor from "@/components/ui/RichTextEditor";
import PlanTimeline from "@/components/ui/PlanTimeline";
import UserAvatar from "@/components/ui/UserAvatar";
import PageHeader from "@/components/layout/PageHeader";
import { AddProjectModal } from "@/components/ui/AddProjectButton";
import { fmtDate } from "@/lib/utils";
import type { ProjectRole, RoleAllocationLine, Session, TaskAssignee } from "@/types";
import { formatEuro } from "@/components/ui/editor-panel/money";
import {
  calculateProjectSubtotal,
  calculateProjectDiscount,
  calculateProjectPayout,
  type DraftProject,
  type DraftTask,
} from "@/components/ui/editor-panel/draft-types";
import DraftProjectCard from "@/components/ui/editor-panel/DraftProjectCard";
import DraftProjectEditor from "@/components/ui/editor-panel/DraftProjectEditor";

// ── Types ────────────────────────────────────────────────────────────────────



interface PlanData {
  id: string;
  clientId: string;
  title: string;
  summary: string | null;
  status: "draft" | "ready" | "accepted" | "finalized";
  vatRate: number | null;
  shareCode: string | null;
  proposerStatement: string | null;
  createdBy: TaskAssignee;
  acceptedBy: TaskAssignee | null;
  acceptedByClient?: { name: string; email: string } | null;
  acceptedAt: string | null;
  finalizedBy?: TaskAssignee | null;
  finalizedAt?: string | null;
  presentedAt: string | null;
  acceptanceLog?: AcceptanceEvent[];
  language?: "nl" | "en";
  validUntilDate?: string | null;
  proposalNumber?: string | null;
  versionLabel?: string | null;
  challenge?: string | null;
  context?: string | null;
  approach?: string | null;
}

interface AcceptanceEvent {
  type: "created" | "sent" | "accepted" | "revoked" | "finalized";
  at: string;
  source: "client" | "internal";
  by: { userId?: string; name: string; email?: string; image?: string };
}


interface ApiResponse {
  plan: PlanData;
  projects: DraftProject[];
  tasksByProject: Record<string, DraftTask[]>;
  sessionsByProject: Record<string, Session[]>;
}


// ── Utility ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<PlanData["status"], { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "var(--bg-neutral)", color: "var(--text-muted)" },
  ready: { label: "Ready", bg: "var(--info-light)", color: "var(--info)" },
  accepted: { label: "Accepted", bg: "var(--success-light)", color: "var(--success)" },
  finalized: { label: "Finalized", bg: "var(--primary-light)", color: "var(--primary)" },
};


const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-surface)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};


// ── Main component ───────────────────────────────────────────────────────────

export default function PlanDetail({
  clientId,
  planId,
  clientCompany,
  projectRoles,
  clientLeads,
}: {
  clientId: string;
  planId: string;
  clientCompany: string;
  projectRoles: ProjectRole[];
  clientLeads: TaskAssignee[];
}) {
  const router = useRouter();
  const canEdit = usePermission("projectPlans.edit");
  const canAccept = usePermission("projectPlans.accept");
  const canFinalize = usePermission("projectPlans.finalize");
  const { openPanel } = useRightPanel();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [data, setData] = useState<ApiResponse | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string; image: string | null }[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"projects" | "content" | "settings">("projects");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/plans/${planId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
    fetch(`/api/users/assignable`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAssignableUsers)
      .catch(() => {});
    void clientLeads;
  }, [clientId, planId, clientLeads]);

  const plan = data?.plan ?? null;
  const projects = useMemo(() => data?.projects ?? [], [data]);

  const subtotal = useMemo(
    () => projects.reduce((sum, p) => sum + calculateProjectSubtotal(p), 0),
    [projects]
  );

  const payoutTotal = useMemo(
    () => projects.reduce((sum, p) => sum + calculateProjectPayout(p), 0),
    [projects]
  );

  const discountAmount = useMemo(
    () => projects.reduce((sum, p) => sum + calculateProjectDiscount(p), 0),
    [projects]
  );

  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const vatAmount = useMemo(
    () => (plan?.vatRate ? subtotalAfterDiscount * (plan.vatRate / 100) : 0),
    [plan, subtotalAfterDiscount]
  );
  const total = subtotalAfterDiscount + vatAmount;

  function updateProject(projectId: string, patch: Partial<DraftProject>) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)),
      };
    });
  }

  function removeProject(projectId: string) {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, projects: prev.projects.filter((p) => p.id !== projectId) };
    });
    router.refresh();
  }

  function handleProjectDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !data) return;
    const current = data.projects;
    const fromIdx = current.findIndex((p) => p.id === active.id);
    const toIdx = current.findIndex((p) => p.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = arrayMove(current, fromIdx, toIdx);
    const prevProjects = current;
    setData((d) => (d ? { ...d, projects: next } : d));

    fetch(`/api/clients/${clientId}/plans/${planId}/projects/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    })
      .then((res) => {
        if (!res.ok) setData((d) => (d ? { ...d, projects: prevProjects } : d));
      })
      .catch(() => setData((d) => (d ? { ...d, projects: prevProjects } : d)));
  }

  async function removeProjectWithConfirm(project: DraftProject) {
    if (!confirm(`Remove "${project.title}" from this plan? Its tasks and sessions will be deleted.`)) return;
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) removeProject(project.id);
  }

  async function refreshSessions(projectId: string) {
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/sessions`);
    if (!res.ok) return;
    const sessions: Session[] = await res.json();
    setData((prev) =>
      prev
        ? {
            ...prev,
            sessionsByProject: { ...prev.sessionsByProject, [projectId]: sessions },
          }
        : prev
    );
  }

  async function refreshTasks(projectId: string) {
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks`);
    if (!res.ok) return;
    const raw: Array<Record<string, unknown>> = await res.json();
    const tasks: DraftTask[] = raw.map((t) => ({
      id: String(t.id),
      clientId: (t.clientId as string | undefined) ?? null,
      projectId: (t.projectId as string | undefined) ?? null,
      parentTaskId: (t.parentTaskId as string | undefined) ?? null,
      sessionId: (t.sessionId as string | undefined) ?? null,
      title: String(t.title),
      description: (t.description as string | undefined) ?? null,
      assignees: (t.assignees as TaskAssignee[] | undefined) ?? [],
      completionDate: (t.completionDate as string | undefined) ?? null,
      completedAt: (t.completedAt as string | undefined) ?? null,
      order: Number(t.order ?? 0),
      createdById: String(t.createdById ?? ""),
      createdByName: String(t.createdByName ?? ""),
    }));
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasksByProject: { ...prev.tasksByProject, [projectId]: tasks },
          }
        : prev
    );
  }

  async function patchPlan(patch: Record<string, unknown>) {
    if (saveResetTimer.current) {
      clearTimeout(saveResetTimer.current);
      saveResetTimer.current = null;
    }
    setSaveState("saving");
    const res = await fetch(`/api/clients/${clientId}/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setData((prev) => (prev ? { ...prev, plan: { ...prev.plan, ...updated } } : prev));
      setSaveState("saved");
      saveResetTimer.current = setTimeout(() => setSaveState("idle"), 2000);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to update plan");
      setSaveState("idle");
    }
  }

  // Per-key debounced patcher: optimistically updates plan state immediately so
  // typing stays fluid + calculations update live, and only sends the PATCH
  // once the user has paused for 1s on that field.
  const debouncedPatchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function patchPlanDebounced(patch: Record<string, unknown>, key: string) {
    setData((prev) => (prev ? { ...prev, plan: { ...prev.plan, ...patch } } : prev));
    if (debouncedPatchTimers.current[key]) clearTimeout(debouncedPatchTimers.current[key]);
    debouncedPatchTimers.current[key] = setTimeout(() => {
      patchPlan(patch);
    }, 1000);
  }
  useEffect(() => {
    const timers = debouncedPatchTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Tracks the last server-committed value for fields that optimistically
  // mirror the input on every keystroke — without this ref the onBlur diff
  // always returns equal and the PATCH never fires.
  const lastSavedRef = useRef<{ title: string; summary: string; proposerStatement: string } | null>(null);
  useEffect(() => {
    if (plan && lastSavedRef.current === null) {
      lastSavedRef.current = {
        title: plan.title ?? "",
        summary: plan.summary ?? "",
        proposerStatement: plan.proposerStatement ?? "",
      };
    }
  }, [plan]);

  async function deletePlan() {
    const draftCount = projects.length;
    const msg = draftCount > 0
      ? `Dit plan en de ${draftCount} draft-project${draftCount === 1 ? "" : "en"} (incl. taken) verwijderen?`
      : "Dit plan verwijderen?";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/clients/${clientId}/plans/${planId}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/clients/${clientId}?tab=projects`);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to delete plan");
    }
  }

  async function acceptPlan() {
    if (!plan) return;
    const msg = `Accept "${plan.title}" on behalf of the client?\n\nThe plan will be locked for editing. Projects stay as drafts until you finalize the plan — which is the irreversible step that promotes them to live.`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/clients/${clientId}/plans/${planId}/accept`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      setData((prev) => prev ? { ...prev, plan: { ...prev.plan, status: result.status, acceptedAt: result.acceptedAt, acceptedBy: result.acceptedBy } } : prev);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to accept plan");
    }
  }

  async function revokePlan() {
    if (!plan) return;
    if (!confirm(
      `Revoke acceptance of "${plan.title}"?\n\nThe plan will move back to draft so it can be edited and re-accepted later. No live projects exist yet, so nothing else is affected.`
    )) return;
    const res = await fetch(`/api/clients/${clientId}/plans/${planId}/revoke`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      setData((prev) => prev ? { ...prev, plan: { ...prev.plan, status: result.status, acceptedAt: null, acceptedBy: null, acceptedByClient: null } } : prev);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to revoke acceptance");
    }
  }

  async function finalizePlan() {
    if (!plan) return;
    const res = await fetch(`/api/clients/${clientId}/plans/${planId}/finalize`, { method: "POST" });
    if (res.ok) {
      router.push(`/clients/${clientId}?tab=projects`);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to finalize plan");
    }
  }

  const finalizeAssignments = useMemo(
    () =>
      projects.flatMap((p) =>
        p.roleAllocation
          .filter((l) => l.assignedUser)
          .map((l) => ({ user: l.assignedUser!.name, role: l.roleName, project: p.title }))
      ),
    [projects]
  );

  function handleDraftCreated(result: { project: Record<string, unknown>; tasks: unknown[]; sessions: unknown[] }) {
    const projectData = result.project as Record<string, unknown>;
    const project: DraftProject = {
      ...(projectData as unknown as DraftProject),
      description: (projectData.description as string | null) ?? null,
      members: (projectData.members as TaskAssignee[] | undefined) ?? [],
      roleAllocation: (projectData.roleAllocation as RoleAllocationLine[] | undefined) ?? [],
    };
    setData((prev) =>
      prev
        ? {
            ...prev,
            projects: [...prev.projects, project],
            tasksByProject: { ...prev.tasksByProject, [project.id]: result.tasks as DraftTask[] },
            sessionsByProject: { ...prev.sessionsByProject, [project.id]: result.sessions as Session[] },
          }
        : prev
    );
  }

  const breadcrumbs = [
    { label: "Clients", href: "/clients" },
    { label: clientCompany, href: `/clients/${clientId}` },
    { label: "Projects", href: `/clients/${clientId}?tab=projects` },
    { label: "Plans", href: `/clients/${clientId}?tab=projects&subtab=plans` },
    { label: "..." },
  ];

  const tertiaryNav = (
    <div role="tablist" aria-label="Plan sections" className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2" style={{ borderColor: "var(--border)" }}>
      {([
        { value: "projects", label: "Projects" },
        { value: "content", label: "About" },
        { value: "settings", label: "Settings" },
      ] as const).map(({ value, label }) => {
        const active = activeTab === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => setActiveTab(value)}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  if (!plan) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader breadcrumbs={breadcrumbs} title="Loading…" tertiaryNav={tertiaryNav} />
        <div className="flex-1 overflow-y-auto">
          <div className="p-7 flex gap-6 items-start">
            <div className="flex-1 min-w-0 space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[68px] rounded-xl border animate-pulse"
                  style={{ borderColor: "var(--border)", background: "var(--bg-neutral)" }}
                />
              ))}
            </div>
            <div
              className="w-1/3 flex-none h-48 rounded-xl border animate-pulse"
              style={{ borderColor: "var(--border)", background: "var(--bg-neutral)" }}
              aria-hidden
            />
          </div>
          <span className="sr-only">Loading plan…</span>
        </div>
      </div>
    );
  }

  const planAccepted = plan.status === "accepted" || plan.status === "finalized";

  // Show status badge only for accepted / finalized — draft and ready are
  // clearly communicated by the Visibility toggle.
  const showStatusBadge = plan.status === "accepted" || plan.status === "finalized";
  const badge = STATUS_BADGE[plan.status];

  const headerActions = (
    <>
      {saveState !== "idle" && (
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {saveState === "saving" ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Check size={12} />
              <span>Saved</span>
            </>
          )}
        </span>
      )}
      {showStatusBadge && (
        <span
          className="typo-tag inline-flex items-center px-2 py-0.5 rounded-badge"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      )}
      {canEdit && (plan.status === "draft" || plan.status === "ready") && (
        <VisibilityToggle
          isVisible={plan.status === "ready"}
          onToggle={() =>
            patchPlan({ status: plan.status === "ready" ? "draft" : "ready" })
          }
        />
      )}
      {plan.shareCode && (
        <CopyLinkButton shareCode={plan.shareCode} />
      )}
      <PlanActionsMenu
        shareCode={plan.shareCode}
        status={plan.status}
        canAcceptForClient={canAccept && (plan.status === "draft" || plan.status === "ready") && projects.length > 0}
        canRevoke={canAccept && plan.status === "accepted"}
        canDelete={canEdit && plan.status !== "finalized"}
        onAcceptForClient={acceptPlan}
        onRevoke={revokePlan}
        onDelete={deletePlan}
      />
    </>
  );

  const acceptorName = plan.acceptedByClient?.name ?? plan.acceptedBy?.name ?? null;
  const acceptorSourceLabel = plan.acceptedByClient ? "client" : "internal";

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={plan.title}
        actions={headerActions}
        tertiaryNav={tertiaryNav}
      />
      {plan.status === "accepted" && (
        <div
          className="px-7 py-4 border-b"
          style={{
            background: "var(--success-light)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="typo-card-title" style={{ color: "var(--success)" }}>
                Plan accepted
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>
                {acceptorName
                  ? `${acceptorName} (${acceptorSourceLabel}) accepted on ${fmtDate(plan.acceptedAt)}.`
                  : `Accepted on ${fmtDate(plan.acceptedAt)}.`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {canAccept && (
                <button
                  type="button"
                  onClick={revokePlan}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium btn-border border"
                  style={{ borderColor: "var(--border)" }}
                >
                  Revoke acceptance
                </button>
              )}
              {canFinalize && (
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium btn-primary inline-flex items-center gap-1.5"
                >
                  <Check size={13} />
                  Finalize plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="p-7">
        {error && (
          <div className="rounded-lg border px-3 py-2 mb-4 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-light)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-6 items-start">
        {/* ── LEFT (2/3): tab content ────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === "projects" && (
            <>
              <PlanTimeline
                drafts={projects.map((p) => ({
                  id: p.id,
                  title: p.title,
                  scheduledStartDate: p.scheduledStartDate,
                  scheduledEndDate: p.scheduledEndDate,
                  serviceName: p.serviceName,
                }))}
              />

              {canEdit && !planAccepted && (
                <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-primary">
                  <Plus size={13} />
                  Add draft project
                </button>
              )}

              {projects.length === 0 ? (
                <div className="flex items-center justify-center h-40 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No drafts yet. Add one from a template or build a blank project.
                  </p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                  <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {projects.map((p) => (
                        <DraftProjectCard
                          key={p.id}
                          project={p}
                          taskCount={(data!.tasksByProject[p.id] ?? []).filter((t) => !t.parentTaskId).length}
                          sessionCount={(data!.sessionsByProject[p.id] ?? []).length}
                          readonly={planAccepted || !canEdit}
                          canRemove={canEdit && !planAccepted}
                          sortDisabled={!canEdit || planAccepted || projects.length < 2}
                          onOpen={() =>
                            openPanel(
                              "Edit project",
                              <DraftProjectEditor
                                project={p}
                                clientId={clientId}
                                planAccepted={planAccepted}
                                canEdit={canEdit}
                                projectRoles={projectRoles}
                                assignableUsers={assignableUsers}
                                tasks={data!.tasksByProject[p.id] ?? []}
                                sessions={data!.sessionsByProject[p.id] ?? []}
                                onUpdate={(patch) => updateProject(p.id, patch)}
                                onSessionsChanged={() => refreshSessions(p.id)}
                                onTasksChanged={() => refreshTasks(p.id)}
                              />,
                              { padded: false }
                            )
                          }
                          onRemove={() => removeProjectWithConfirm(p)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}

          {activeTab === "content" && (
            <div className="space-y-10">
              {/* Title */}
              <section>
                <h3 className="typo-section-title mb-1" style={{ color: "var(--text-primary)" }}>Title</h3>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  Headline of the proposal — also shown in the page header and on the public share page.
                </p>
                <input
                  type="text"
                  value={plan.title}
                  disabled={planAccepted || !canEdit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setData((prev) => prev ? { ...prev, plan: { ...prev.plan, title: v } } : prev);
                  }}
                  onBlur={(e) => {
                    if (planAccepted || !canEdit) return;
                    const next = e.target.value.trim();
                    if (!next) return;
                    if (lastSavedRef.current && next === lastSavedRef.current.title.trim()) return;
                    if (lastSavedRef.current) lastSavedRef.current.title = next;
                    patchPlan({ title: next });
                  }}
                  placeholder="e.g. Q3 2026 proposal"
                  className={inputClass}
                  style={inputStyle}
                />
              </section>

              {/* Summary */}
              <section>
                <h3 className="typo-section-title mb-1" style={{ color: "var(--text-primary)" }}>Summary</h3>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  Optional intro shown at the top of the public proposal — frames what you&apos;re proposing.
                </p>
                <RichTextEditor
                  content={plan.summary ?? ""}
                  onChange={(html) => setData((prev) => prev ? { ...prev, plan: { ...prev.plan, summary: html } } : prev)}
                  onBlur={(html) => {
                    if (planAccepted || !canEdit) return;
                    if (lastSavedRef.current && html === lastSavedRef.current.summary) return;
                    if (lastSavedRef.current) lastSavedRef.current.summary = html;
                    patchPlan({ summary: html });
                  }}
                  placeholder="Type your summary here…"
                />
              </section>

              {/* Personal statement */}
              <section>
                <h3 className="typo-section-title mb-1" style={{ color: "var(--text-primary)" }}>Personal statement</h3>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  One sentence shown next to your photo in the public proposal — sets a personal tone for the client.
                </p>
                <input
                  type="text"
                  value={plan.proposerStatement ?? ""}
                  disabled={planAccepted || !canEdit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setData((prev) => prev ? { ...prev, plan: { ...prev.plan, proposerStatement: v } } : prev);
                  }}
                  onBlur={(e) => {
                    if (planAccepted || !canEdit) return;
                    const nextTrimmed = e.target.value.trim();
                    if (lastSavedRef.current && nextTrimmed === lastSavedRef.current.proposerStatement.trim()) return;
                    if (lastSavedRef.current) lastSavedRef.current.proposerStatement = nextTrimmed;
                    patchPlan({ proposerStatement: nextTrimmed || null });
                  }}
                  placeholder="e.g. I'll personally see this engagement through."
                  className={inputClass}
                  style={inputStyle}
                />
              </section>

              {/* Background & approach — three optional rich-text fields */}
              <section>
                <h3 className="typo-section-title mb-1" style={{ color: "var(--text-primary)" }}>Background &amp; approach</h3>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  Optional — appears on the public page and in the PDF below the summary.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="typo-label">Problem description (challenge)</label>
                    <RichTextEditor
                      content={plan.challenge ?? ""}
                      onChange={(html) => setData((prev) => prev ? { ...prev, plan: { ...prev.plan, challenge: html } } : prev)}
                      onBlur={(html) => {
                        if (planAccepted || !canEdit) return;
                        patchPlan({ challenge: html || null });
                      }}
                      placeholder="What challenge is the client facing?"
                    />
                  </div>
                  <div>
                    <label className="typo-label">Background / context</label>
                    <RichTextEditor
                      content={plan.context ?? ""}
                      onChange={(html) => setData((prev) => prev ? { ...prev, plan: { ...prev.plan, context: html } } : prev)}
                      onBlur={(html) => {
                        if (planAccepted || !canEdit) return;
                        patchPlan({ context: html || null });
                      }}
                      placeholder="What's the background for this proposal?"
                    />
                  </div>
                  <div>
                    <label className="typo-label">Approach description</label>
                    <RichTextEditor
                      content={plan.approach ?? ""}
                      onChange={(html) => setData((prev) => prev ? { ...prev, plan: { ...prev.plan, approach: html } } : prev)}
                      onBlur={(html) => {
                        if (planAccepted || !canEdit) return;
                        patchPlan({ approach: html || null });
                      }}
                      placeholder="How are we going to tackle it?"
                    />
                  </div>
                </div>
              </section>

            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-8">
              {/* Document settings — language, validity, version, offertenummer */}
              <section>
                <h3 className="typo-section-title mb-1" style={{ color: "var(--text-primary)" }}>Document settings</h3>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  Language, validity, version. The proposal number is auto-assigned on &quot;Mark as ready&quot;.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="typo-label">Language</label>
                    <select
                      value={plan.language ?? "nl"}
                      disabled={planAccepted || !canEdit}
                      onChange={(e) => {
                        const v = e.target.value === "en" ? "en" : "nl";
                        setData((prev) => prev ? { ...prev, plan: { ...prev.plan, language: v } } : prev);
                        patchPlan({ language: v });
                      }}
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="nl">Dutch</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="typo-label">Valid until</label>
                    <input
                      type="date"
                      value={plan.validUntilDate ?? ""}
                      disabled={planAccepted || !canEdit}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setData((prev) => prev ? { ...prev, plan: { ...prev.plan, validUntilDate: v } } : prev);
                        patchPlan({ validUntilDate: v });
                      }}
                      className={inputClass}
                      style={inputStyle}
                      title={plan.presentedAt ? "Empty = defaults to 30 days after sending" : "Defaults to 30 days after sending unless filled in here"}
                    />
                  </div>
                  <div>
                    <label className="typo-label">Version</label>
                    <input
                      type="text"
                      value={plan.versionLabel ?? ""}
                      disabled={planAccepted || !canEdit}
                      onChange={(e) => {
                        const v = e.target.value;
                        setData((prev) => prev ? { ...prev, plan: { ...prev.plan, versionLabel: v } } : prev);
                      }}
                      onBlur={(e) => {
                        if (planAccepted || !canEdit) return;
                        patchPlan({ versionLabel: e.target.value.trim() || null });
                      }}
                      placeholder="V1"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="typo-label">Proposal number</label>
                  <input
                    type="text"
                    value={plan.proposalNumber ?? ""}
                    disabled
                    readOnly
                    placeholder="Assigned on Mark as ready"
                    className={inputClass}
                    style={{ ...inputStyle, opacity: 0.65 }}
                  />
                </div>
              </section>

              {/* Pricing terms */}
              <section>
                <h3 className="typo-section-title mb-1" style={{ color: "var(--text-primary)" }}>Pricing terms</h3>
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  Plan-wide VAT. Discounts are set per project in each project&apos;s Budget tab.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="typo-label">VAT rate (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={plan.vatRate ?? ""}
                      disabled={planAccepted || !canEdit}
                      onChange={(e) =>
                        patchPlanDebounced(
                          { vatRate: e.target.value === "" ? null : Number(e.target.value) },
                          "vatRate"
                        )
                      }
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* ── RIGHT: sticky sidebar (1/3) ─────────────────── */}
        <div className="w-1/3 flex-none sticky top-6 space-y-4">
          {/* Acceptance history — full audit trail of accept / revoke events */}
          {plan.acceptanceLog && plan.acceptanceLog.length > 0 && (
            <AcceptanceHistory log={plan.acceptanceLog} />
          )}

          {/* Budget card — totals only; pricing inputs live in the Proposal content tab */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          >
          <h3 className="typo-section-title mb-4" style={{ color: "var(--text-primary)" }}>Budget</h3>

          <div className="space-y-2 text-sm" style={{ color: "var(--text-primary)" }}>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
              <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{formatEuro(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Discount</span>
                <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>− {formatEuro(discountAmount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Net</span>
                <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{formatEuro(subtotalAfterDiscount)}</span>
              </div>
            )}
            {plan.vatRate ? (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>VAT ({plan.vatRate}%)</span>
                <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>{formatEuro(vatAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
              <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatEuro(total)}</span>
            </div>
          </div>

          {payoutTotal > 0 && (
            <div
              className="mt-4 rounded-lg px-4 py-3 space-y-2 text-sm"
              style={{ background: "var(--bg-app)", border: "1px dashed var(--border)" }}
              title="Internal-only — not part of the client-facing total"
            >
              <div className="flex items-center justify-between">
                <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                  External pay-out
                </p>
                <span
                  className="typo-tag inline-flex items-center px-1.5 py-0.5 rounded-badge"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                >
                  Internal only
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Pay-out to externals</span>
                <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                  − {formatEuro(payoutTotal)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>Net for SUMM</span>
                <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatEuro(subtotalAfterDiscount - payoutTotal)}
                </span>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
    {showFinalizeModal && (
      <FinalizeConfirmModal
        planTitle={plan.title}
        projectCount={projects.length}
        assignments={finalizeAssignments}
        onClose={() => setShowFinalizeModal(false)}
        onConfirm={() => { setShowFinalizeModal(false); finalizePlan(); }}
      />
    )}
    <AddProjectModal
      clientId={clientId}
      planId={planId}
      open={addModalOpen}
      onClose={() => setAddModalOpen(false)}
      onDraftCreated={handleDraftCreated}
    />
    </>
  );
}

// ── Finalize confirmation modal ─────────────────────────────────────────────

function FinalizeConfirmModal({
  planTitle,
  projectCount,
  assignments,
  onClose,
  onConfirm,
}: {
  planTitle: string;
  projectCount: number;
  assignments: { user: string; role: string; project: string }[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl p-6 shadow-dropdown" style={{ background: "var(--bg-surface)" }}>
        <h2 className="typo-modal-title mb-2" style={{ color: "var(--text-primary)" }}>
          Finalize &ldquo;{planTitle}&rdquo;?
        </h2>
        <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          This promotes {projectCount} draft{projectCount === 1 ? "" : "s"} to live projects (status &ldquo;upcoming&rdquo;).{" "}
          <strong style={{ color: "var(--text-primary)" }}>This action is irreversible.</strong>
        </p>
        {assignments.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              Members that will be added
            </p>
            <ul className="text-sm space-y-1.5 mb-2 max-h-48 overflow-y-auto" style={{ color: "var(--text-primary)" }}>
              {assignments.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: "var(--text-muted)" }}>•</span>
                  <span>
                    <strong>{a.user}</strong> → {a.role} on {a.project}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost rounded-lg flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg text-white btn-primary"
          >
            Finalize plan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Visibility toggle (draft ↔ ready) ───────────────────────────────────────
// One switch the consultant flips to control whether the share link shows the
// full proposal (ready) or the maintenance state (draft). Visually it's a pill
// with an inline label so the state reads naturally next to the other actions.

function VisibilityToggle({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
      style={{
        borderColor: "var(--border)",
        background: isVisible ? "var(--primary-light)" : "var(--bg-elevated)",
        color: isVisible ? "var(--primary)" : "var(--text-muted)",
      }}
      title={
        isVisible
          ? "Visible to the client via the share link — click to hide and continue editing"
          : "Hidden from the client — click to make the share link show the proposal"
      }
    >
      <span
        className="relative inline-flex shrink-0 items-center rounded-full transition-colors"
        style={{
          width: 30,
          height: 16,
          background: isVisible ? "var(--primary)" : "var(--border)",
        }}
        aria-hidden
      >
        <span
          className="absolute rounded-full transition-transform"
          style={{
            width: 12,
            height: 12,
            top: 2,
            left: 2,
            background: "var(--bg-surface)",
            transform: isVisible ? "translateX(14px)" : "translateX(0)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </span>
      <span>{isVisible ? "Visible to client" : "Hidden — working on it"}</span>
    </button>
  );
}

// ── Acceptance history (timeline of accept / revoke events) ─────────────────

function formatEventDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: fmtDate(iso), time: "" };
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function AcceptanceHistory({ log }: { log: AcceptanceEvent[] }) {
  // Hide "sent" events here — the Visibility toggle now communicates that state
  // in real time. Created / Accepted / Revoked stay so client-facing actions
  // remain auditable. Newest first.
  const events = [...log]
    .filter((e) => e.type !== "sent")
    .sort((a, b) => b.at.localeCompare(a.at));
  if (events.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <h4
        className="typo-section-header mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        Acceptance history
      </h4>
      <ol className="relative">
        {events.map((e, i) => {
          const cfg =
            e.type === "accepted"
              ? { color: "var(--success)", icon: <Check size={10} strokeWidth={3} />, label: "Accepted" }
              : e.type === "revoked"
                ? { color: "var(--warning)", icon: <X size={10} strokeWidth={3} />, label: "Revoked" }
                : e.type === "sent"
                  ? { color: "var(--info)", icon: <Send size={9} strokeWidth={2.5} />, label: "Marked as ready" }
                  : { color: "var(--text-muted)", icon: <Plus size={10} strokeWidth={3} />, label: "Created" };
          const { date, time } = formatEventDate(e.at);
          const isLast = i === events.length - 1;
          return (
            <li key={`${e.at}-${i}`} className="relative pl-7 pb-4 last:pb-0">
              {/* connector line */}
              {!isLast && (
                <span
                  className="absolute top-3 bottom-0 w-px"
                  style={{ left: 7, background: "var(--border)" }}
                  aria-hidden
                />
              )}
              {/* dot */}
              <span
                className="absolute top-1 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ left: 0, background: cfg.color, color: "white" }}
                aria-hidden
              >
                {cfg.icon}
              </span>

              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
                {cfg.label}
                <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: "var(--text-muted)" }}>
                  {e.type === "created"
                    ? "(plan started)"
                    : e.type === "sent"
                      ? "(ready for client)"
                      : e.source === "client"
                        ? "via share link"
                        : "internally"}
                </span>
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                {e.source === "internal" && (
                  <UserAvatar name={e.by.name} image={e.by.image ?? null} size={16} />
                )}
                <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                  <strong>{e.by.name}</strong>
                  {e.by.email ? (
                    <span style={{ color: "var(--text-muted)" }}> · {e.by.email}</span>
                  ) : null}
                </p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {date}{time ? ` · ${time}` : ""}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Copy share link (always-visible header action) ─────────────────────────

function CopyLinkButton({ shareCode }: { shareCode: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/proposal/${shareCode}`
    : `/proposal/${shareCode}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be blocked
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-border border"
      style={{ borderColor: "var(--border)" }}
      title={copied ? "Link copied" : "Copy public proposal link"}
    >
      {copied ? <Check size={13} /> : <LinkIcon size={13} />}
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

// ── Plan actions menu (kebab dropdown) ──────────────────────────────────────
// Holds the lower-frequency / destructive actions so the header stays focused
// on the primary state-change controls (Visibility toggle, Revoke acceptance).

function PlanActionsMenu({
  shareCode,
  status,
  canAcceptForClient,
  canRevoke,
  canDelete,
  onAcceptForClient,
  onRevoke,
  onDelete,
}: {
  shareCode: string | null;
  status: "draft" | "ready" | "accepted" | "finalized";
  canAcceptForClient: boolean;
  canRevoke: boolean;
  canDelete: boolean;
  onAcceptForClient: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const showOpenInTab = !!shareCode;
  const showPdfPreview = !!shareCode && (status === "ready" || status === "accepted");
  const url = typeof window !== "undefined" && shareCode
    ? `${window.location.origin}/proposal/${shareCode}`
    : shareCode ? `/proposal/${shareCode}` : "";
  const pdfUrl = url ? `${url}/pdf` : "";

  function openLink() {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function openPdfPreview() {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  // If nothing's available to show, omit the menu entirely
  if (!showOpenInTab && !canAcceptForClient && !canRevoke && !canDelete && !showPdfPreview) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md btn-icon"
        title="More actions"
        aria-label="More actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-9 z-20 rounded-xl border shadow-lg overflow-hidden w-56"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            {showOpenInTab && (
              <button
                type="button"
                onClick={openLink}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <ExternalLink size={14} />
                <span>Open in new tab</span>
              </button>
            )}
            {showPdfPreview && (
              <button
                type="button"
                onClick={openPdfPreview}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <Download size={14} />
                <span>Open PDF preview</span>
              </button>
            )}
            {(showOpenInTab || showPdfPreview) && (canAcceptForClient || canRevoke || canDelete) && (
              <div style={{ height: 1, background: "var(--border)" }} />
            )}
            {canAcceptForClient && (
              <button
                type="button"
                onClick={() => { setOpen(false); onAcceptForClient(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <Check size={14} />
                <span>Accept plan for client</span>
              </button>
            )}
            {canRevoke && (
              <button
                type="button"
                onClick={() => { setOpen(false); onRevoke(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                <X size={14} />
                <span>Revoke acceptance</span>
              </button>
            )}
            {canDelete && (
              <>
                {(canAcceptForClient || canRevoke) && <div style={{ height: 1, background: "var(--border)" }} />}
                <button
                  type="button"
                  onClick={() => { setOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ color: "var(--danger)" }}
                >
                  <Trash2 size={14} />
                  <span>Delete plan</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
