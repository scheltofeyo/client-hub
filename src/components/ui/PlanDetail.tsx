"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight, Check, X, Send, Eye, EyeOff, Pencil, ExternalLink, MoreHorizontal, Link as LinkIcon, GripVertical, Download, Loader2 } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { usePermission } from "@/hooks/usePermission";
import RichTextEditor from "@/components/ui/RichTextEditor";
import PlanTimeline from "@/components/ui/PlanTimeline";
import UserAvatar from "@/components/ui/UserAvatar";
import PageHeader from "@/components/layout/PageHeader";
import { SessionForm } from "@/components/ui/SessionsTab";
import { TaskForm, TaskRow, InlineTaskInput } from "@/components/ui/task-row";
import { AddProjectModal } from "@/components/ui/AddProjectButton";
import { fmtDate } from "@/lib/utils";
import type { ProjectRole, RoleAllocationLine, Session, Task, TaskAssignee } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface DraftProject {
  id: string;
  clientId: string;
  planId: string;
  title: string;
  description: string | null;
  why: string | null;
  how: string | null;
  what: string | null;
  activities: string | null;
  deliverables: string | null;
  hiddenSections: string[];
  status: "draft" | "not_started" | "in_progress" | "completed";
  soldPrice: number | null;
  pricingMode: "manual" | "rolebased";
  roleAllocation: RoleAllocationLine[];
  serviceId: string | null;
  serviceName: string | null;
  templateId: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  members: TaskAssignee[];
  createdAt?: string | null;
}

const SECTION_KEYS = ["why", "what", "how", "activities", "deliverables"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

interface PlanData {
  id: string;
  clientId: string;
  title: string;
  summary: string | null;
  status: "draft" | "ready" | "accepted" | "finalized";
  discountType: "percentage" | "amount" | null;
  discountValue: number | null;
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

interface DraftTask {
  id: string;
  clientId: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  sessionId: string | null;
  title: string;
  description: string | null;
  assignees: TaskAssignee[];
  completionDate: string | null;
  completedAt: string | null;
  order: number;
  createdById: string;
  createdByName: string;
}

interface ApiResponse {
  plan: PlanData;
  projects: DraftProject[];
  tasksByProject: Record<string, DraftTask[]>;
  sessionsByProject: Record<string, Session[]>;
}

function draftTaskToTask(t: DraftTask): Task {
  return {
    id: t.id,
    clientId: t.clientId ?? undefined,
    projectId: t.projectId ?? undefined,
    parentTaskId: t.parentTaskId ?? undefined,
    sessionId: t.sessionId ?? undefined,
    title: t.title,
    description: t.description ?? undefined,
    assignees: t.assignees,
    completionDate: t.completionDate ?? undefined,
    completedAt: t.completedAt ?? undefined,
    order: t.order,
    createdById: t.createdById,
    createdByName: t.createdByName,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<PlanData["status"], { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "var(--bg-hover)", color: "var(--text-muted)" },
  ready: { label: "Ready", bg: "var(--info-light)", color: "var(--info)" },
  accepted: { label: "Accepted", bg: "var(--success-light)", color: "var(--success)" },
  finalized: { label: "Finalized", bg: "var(--primary-light)", color: "var(--primary)" },
};

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function calculateLineTotal(line: RoleAllocationLine) {
  return (line.days || 0) * (line.dayRate || 0) * (line.marginMultiplier || 1);
}

function calculateLinePayout(line: RoleAllocationLine) {
  if (!line.isExternal || line.externalCostRate == null) return 0;
  return (line.days || 0) * line.externalCostRate;
}

function calculateProjectSubtotal(p: DraftProject): number {
  if (p.pricingMode === "rolebased" && p.roleAllocation) {
    return p.roleAllocation.reduce((sum, l) => sum + calculateLineTotal(l), 0);
  }
  return p.soldPrice ?? 0;
}

function calculateProjectPayout(p: DraftProject): number {
  if (p.pricingMode !== "rolebased" || !p.roleAllocation) return 0;
  return p.roleAllocation.reduce((sum, l) => sum + calculateLinePayout(l), 0);
}

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-surface)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

// ── Role allocation editor ────────────────────────────────────────────────────

function RoleAllocationEditor({
  pricingMode,
  allocation,
  projectRoles,
  assignableUsers,
  readonly,
  onChange,
}: {
  pricingMode: "manual" | "rolebased";
  allocation: RoleAllocationLine[];
  projectRoles: ProjectRole[];
  assignableUsers: { id: string; name: string; image: string | null }[];
  readonly: boolean;
  onChange: (allocation: RoleAllocationLine[], pricingMode: "manual" | "rolebased") => void;
}) {
  function setMode(nextMode: "manual" | "rolebased") {
    onChange(allocation, nextMode);
  }

  function addLine() {
    if (projectRoles.length === 0) return;
    const role = projectRoles[0];
    const next: RoleAllocationLine = {
      roleId: role.id,
      roleName: role.name,
      days: 0,
      dayRate: role.dayRate,
      marginMultiplier: role.marginMultiplier,
      isExternal: role.isExternal,
      externalCostRate: role.isExternal ? role.externalCostRate : undefined,
    };
    onChange([...allocation, next], pricingMode);
  }

  function updateLine(i: number, patch: Partial<RoleAllocationLine>) {
    const next = allocation.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(next, pricingMode);
  }

  function changeRole(i: number, roleId: string) {
    const role = projectRoles.find((r) => r.id === roleId);
    if (!role) return;
    updateLine(i, {
      roleId,
      roleName: role.name,
      dayRate: role.dayRate,
      marginMultiplier: role.marginMultiplier,
      isExternal: role.isExternal,
      externalCostRate: role.isExternal ? role.externalCostRate : undefined,
    });
  }

  function removeLine(i: number) {
    onChange(allocation.filter((_, idx) => idx !== i), pricingMode);
  }

  function assignUser(i: number, userId: string) {
    if (!userId) {
      updateLine(i, { assignedUser: undefined });
      return;
    }
    const u = assignableUsers.find((x) => x.id === userId);
    if (!u) return;
    updateLine(i, { assignedUser: { userId: u.id, name: u.name, image: u.image ?? undefined } });
  }

  const mode = pricingMode;
  const lines = allocation;
  const total = lines.reduce((s, l) => s + calculateLineTotal(l), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-md border p-0.5"
            style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          >
            {(["rolebased", "manual"] as const).map((m) => (
              <button
                key={m}
                disabled={readonly}
                onClick={() => setMode(m)}
                className="px-2 py-1 text-xs font-medium rounded-sm transition-colors"
                style={{
                  background: mode === m ? "var(--bg-surface)" : "transparent",
                  color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {m === "manual" ? "Fixed" : "Role-based"}
              </button>
            ))}
          </div>
        </div>
        {mode === "rolebased" && (
          <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
            {formatEuro(total)}
          </span>
        )}
      </div>

      {mode === "rolebased" && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="grid items-center px-3 py-2 typo-section-header"
            style={{
              gridTemplateColumns: "1fr 70px 1fr 110px 32px",
              gap: 8,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
            }}
          >
            <span>Role</span>
            <span>Days</span>
            <span>Assigned</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid items-center px-3 py-2 text-sm"
              style={{
                gridTemplateColumns: "1fr 70px 1fr 110px 32px",
                gap: 8,
                borderBottom: i < lines.length - 1 ? "1px solid var(--border)" : undefined,
              }}
            >
              <select
                value={line.roleId}
                disabled={readonly}
                onChange={(e) => changeRole(i, e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                {projectRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.isExternal ? " (ext)" : ""}
                  </option>
                ))}
                {projectRoles.findIndex((r) => r.id === line.roleId) === -1 && (
                  <option value={line.roleId}>{line.roleName} (removed)</option>
                )}
              </select>
              <input
                type="number"
                min={0}
                step={0.5}
                value={line.days}
                disabled={readonly}
                onChange={(e) => updateLine(i, { days: Number(e.target.value) })}
                className={inputClass}
                style={{ ...inputStyle, textAlign: "right" }}
              />
              <select
                value={line.assignedUser?.userId ?? ""}
                disabled={readonly}
                onChange={(e) => assignUser(i, e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— unassigned —</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatEuro(calculateLineTotal(line))}
              </span>
              <button
                onClick={() => removeLine(i)}
                disabled={readonly}
                className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)] disabled:opacity-30"
                title="Remove line"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {lines.length === 0 && (
            <div className="px-3 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No role lines yet.
            </div>
          )}
        </div>
      )}

      {mode === "rolebased" && !readonly && (
        <button
          onClick={addLine}
          disabled={projectRoles.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-tertiary disabled:opacity-50"
        >
          <Plus size={12} />
          Add role line
        </button>
      )}
      {projectRoles.length === 0 && mode === "rolebased" && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No project roles defined yet — set them up in admin → Labels and Types → Project Roles.
        </p>
      )}
    </div>
  );
}

// ── Draft tasks list ──────────────────────────────────────────────────────────
// Renders a draft project's tasks using the shared TaskRow primitive so behavior
// matches the regular project Tasks tab (drag-to-reorder, subtasks, inline add).

function DraftTasksList({
  clientId,
  projectId,
  tasks: serverTasks,
  users,
  readonly,
  canCreateTask,
  canEditAnyTask,
  canDeleteAnyTask,
  onTasksChanged,
}: {
  clientId: string;
  projectId: string;
  tasks: DraftTask[];
  users: { id: string; name: string; image: string | null }[];
  readonly: boolean;
  canCreateTask: boolean;
  canEditAnyTask: boolean;
  canDeleteAnyTask: boolean;
  onTasksChanged: () => void | Promise<void>;
}) {
  const [tasks, setTasks] = useState<Task[]>(() => serverTasks.map(draftTaskToTask));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleInFlightRef = useRef<Set<string>>(new Set());
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const { openPanel, closePanel } = useRightPanel();

  useEffect(() => {
    const incoming = serverTasks.map(draftTaskToTask);
    setTasks((prev) => {
      const prevById = new Map(prev.map((t) => [t.id, t]));
      const serverIds = new Set(incoming.map((t) => t.id));
      const merged: Task[] = incoming.map((serverTask) => {
        if (toggleInFlightRef.current.has(serverTask.id)) {
          return prevById.get(serverTask.id) ?? serverTask;
        }
        return serverTask;
      });
      for (const local of prev) {
        if (!serverIds.has(local.id)) merged.push(local);
      }
      return merged;
    });
  }, [serverTasks]);

  const userImages = useMemo(
    () => Object.fromEntries(users.filter((u) => u.image).map((u) => [u.id, u.image!])),
    [users]
  );

  const topLevel = tasks.filter((t) => !t.parentTaskId);
  const subtasksOf = useCallback(
    (id: string) => tasks.filter((t) => t.parentTaskId === id),
    [tasks]
  );

  const isFullyCompleted = useCallback(
    (task: Task) => {
      if (!task.completedAt) return false;
      const subs = subtasksOf(task.id);
      return subs.every((s) => !!s.completedAt);
    },
    [subtasksOf]
  );

  const openTopLevel = topLevel
    .filter((t) => !isFullyCompleted(t))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const completedTopLevel = topLevel
    .filter((t) => isFullyCompleted(t))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSaved(saved: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    if (saved.parentTaskId) {
      setExpandedIds((prev) => new Set([...prev, saved.parentTaskId!]));
    }
    onTasksChanged();
  }

  function openEditTask(task: Task) {
    const parentTask = task.parentTaskId ? tasks.find((t) => t.id === task.parentTaskId) : undefined;
    openPanel(
      "Edit Task",
      <TaskForm
        projectId={projectId}
        clientId={clientId}
        task={task}
        parentTaskTitle={parentTask?.title}
        isSubtask={!!task.parentTaskId}
        parentAssignees={parentTask?.assignees}
        users={users}
        onSaved={handleSaved}
        onClose={closePanel}
      />
    );
  }

  function handleAddSubtask(parentTaskId: string) {
    setInlineSubtaskFor(parentTaskId);
    setExpandedIds((prev) => new Set([...prev, parentTaskId]));
  }

  async function handleInlineAddTask(title: string) {
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const saved = await res.json();
      handleSaved(saved);
    }
  }

  async function handleInlineSubtaskSave(parentTaskId: string, title: string) {
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parentTaskId }),
    });
    if (res.ok) {
      const saved = await res.json();
      handleSaved(saved);
    }
  }

  async function handleToggleComplete(task: Task) {
    if (toggleInFlightRef.current.has(task.id)) return;
    const completed = !task.completedAt;
    const affected = task.parentTaskId ? [task] : [task, ...subtasksOf(task.id)];
    for (const a of affected) toggleInFlightRef.current.add(a.id);

    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => {
        if (!affected.some((a) => a.id === t.id)) return t;
        return { ...t, completedAt: completed ? now : undefined, completedById: undefined, completedByName: undefined };
      })
    );

    try {
      const results = await Promise.all(
        affected.map((t) =>
          fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed }),
          }).then((r) => (r.ok ? r.json() : null))
        )
      );
      const saved = results.filter(Boolean) as Task[];
      if (saved.length === affected.length) {
        setTasks((prev) => prev.map((t) => saved.find((s) => s.id === t.id) ?? t));
      } else {
        setTasks((prev) => prev.map((t) => affected.find((a) => a.id === t.id) ?? t));
      }
    } finally {
      for (const a of affected) toggleInFlightRef.current.delete(a.id);
      onTasksChanged();
    }
  }

  async function handleDelete(taskId: string, hasSubtasks: boolean) {
    const msg = hasSubtasks
      ? "Delete this task and all its subtasks? This cannot be undone."
      : "Delete this task? This cannot be undone.";
    if (!confirm(msg)) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId && t.parentTaskId !== taskId));

    await fetch(
      `/api/clients/${clientId}/projects/${projectId}/tasks/${taskId}`,
      { method: "DELETE" }
    );
    onTasksChanged();
  }

  async function reorderTopLevel(fromId: string, toId: string) {
    const reordered = [...openTopLevel];
    const fromIdx = reordered.findIndex((t) => t.id === fromId);
    const toIdx = reordered.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderMap = Object.fromEntries(reordered.map((t, i) => [t.id, i]));
    setTasks((prev) => prev.map((t) => (t.id in orderMap ? { ...t, order: orderMap[t.id] } : t)));
    await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((t) => t.id) }),
    });
    onTasksChanged();
  }

  async function reorderSubtasks(fromId: string, toId: string, parentId: string) {
    const siblings = tasks
      .filter((t) => t.parentTaskId === parentId && !t.completedAt)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const fromIdx = siblings.findIndex((t) => t.id === fromId);
    const toIdx = siblings.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderMap = Object.fromEntries(reordered.map((t, i) => [t.id, i]));
    setTasks((prev) => prev.map((t) => (t.id in orderMap ? { ...t, order: orderMap[t.id] } : t)));
    await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((t) => t.id) }),
    });
    onTasksChanged();
  }

  async function moveSubtask(subtaskId: string, newParentId: string, insertBeforeId?: string) {
    const subtask = tasks.find((t) => t.id === subtaskId);
    const newParent = tasks.find((t) => t.id === newParentId);
    if (!subtask || !newParent) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === subtaskId
          ? { ...t, parentTaskId: newParentId, assignees: newParent.assignees }
          : t
      )
    );
    setExpandedIds((prev) => new Set([...prev, newParentId]));

    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentTaskId: newParentId }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === subtaskId ? subtask : t)));
      return;
    }
    const saved = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === subtaskId ? saved : t)));

    if (insertBeforeId) {
      await reorderSubtasks(subtaskId, insertBeforeId, newParentId);
    }
    onTasksChanged();
  }

  async function handleDrop(dropTargetId: string) {
    const fromId = draggingId;
    if (!fromId || fromId === dropTargetId) return;
    setDraggingId(null);
    setDragOverId(null);

    const dragging = tasks.find((t) => t.id === fromId);
    const target = tasks.find((t) => t.id === dropTargetId);
    if (!dragging || !target) return;

    const draggingHasChildren = subtasksOf(fromId).length > 0;

    if (!dragging.parentTaskId && !target.parentTaskId) {
      await reorderTopLevel(fromId, dropTargetId);
    } else if (!draggingHasChildren && dragging.parentTaskId && !target.parentTaskId) {
      await moveSubtask(fromId, dropTargetId);
    } else if (!draggingHasChildren && dragging.parentTaskId && target.parentTaskId) {
      if (dragging.parentTaskId === target.parentTaskId) {
        await reorderSubtasks(fromId, dropTargetId, dragging.parentTaskId);
      } else {
        await moveSubtask(fromId, target.parentTaskId, dropTargetId);
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {openTopLevel.length === 0 && !showInlineAdd && (
        <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
          No tasks yet.
        </p>
      )}

      <div>
        {openTopLevel.map((task, idx) => {
          const fromIdx = draggingId ? openTopLevel.findIndex((t) => t.id === draggingId) : -1;
          const isDragOverBottom = dragOverId === task.id && fromIdx !== -1 && fromIdx < idx;
          return (
            <TaskRow
              key={task.id}
              task={task}
              subtasks={subtasksOf(task.id)}
              isExpanded={expandedIds.has(task.id)}
              onToggleExpand={() => toggleExpand(task.id)}
              onToggleComplete={handleToggleComplete}
              onEdit={openEditTask}
              onAddSubtask={handleAddSubtask}
              onDelete={handleDelete}
              showInlineSubtask={inlineSubtaskFor === task.id}
              onInlineSubtaskSave={(title) => handleInlineSubtaskSave(task.id, title)}
              onInlineSubtaskCancel={() => setInlineSubtaskFor(null)}
              userImages={userImages}
              readOnly={readonly}
              canEdit={!readonly && canEditAnyTask}
              canDelete={!readonly && canDeleteAnyTask}
              canComplete={false}
              today={today}
              isDraggable={!readonly && !task.completedAt}
              draggingId={draggingId}
              draggingHasChildren={!!draggingId && subtasksOf(draggingId).length > 0}
              dragOverId={dragOverId}
              isDragOverBottom={isDragOverBottom}
              onDragStart={(id) => setDraggingId(id)}
              onDragOver={(id) => setDragOverId(id)}
              onDrop={handleDrop}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
            />
          );
        })}
      </div>

      {!readonly && canCreateTask && (
        <div className="mt-2">
          {showInlineAdd ? (
            <InlineTaskInput
              placeholder="Type a task title…"
              onSave={handleInlineAddTask}
              onCancel={() => setShowInlineAdd(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowInlineAdd(true)}
              className="flex items-center gap-1.5 text-sm py-2 px-2 rounded-lg btn-tertiary"
            >
              <Plus size={13} />
              New task
            </button>
          )}
        </div>
      )}

      {completedTopLevel.length > 0 && (
        <>
          <p className="typo-section-header mt-6 mb-3" style={{ color: "var(--text-muted)" }}>
            Completed tasks
          </p>
          <div>
            {completedTopLevel.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                subtasks={subtasksOf(task.id)}
                isExpanded={expandedIds.has(task.id)}
                onToggleExpand={() => toggleExpand(task.id)}
                onToggleComplete={handleToggleComplete}
                onEdit={openEditTask}
                onAddSubtask={handleAddSubtask}
                onDelete={handleDelete}
                showInlineSubtask={false}
                onInlineSubtaskSave={async () => {}}
                onInlineSubtaskCancel={() => {}}
                userImages={userImages}
                readOnly
                canEdit={!readonly && canEditAnyTask}
                canDelete={!readonly && canDeleteAnyTask}
                canComplete={false}
                today={today}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Draft card ────────────────────────────────────────────────────────────────

function DraftCard({
  project,
  clientId,
  planAccepted,
  projectRoles,
  assignableUsers,
  canEdit,
  onUpdate,
  onRemove,
  onSessionsChanged,
  onTasksChanged,
  tasks,
  sessions,
  isDraggable,
  isDragOver,
  isDragOverBottom,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  project: DraftProject;
  clientId: string;
  planAccepted: boolean;
  projectRoles: ProjectRole[];
  assignableUsers: { id: string; name: string; image: string | null }[];
  canEdit: boolean;
  onUpdate: (next: Partial<DraftProject>) => void;
  onRemove: () => void;
  onSessionsChanged: () => void | Promise<void>;
  onTasksChanged: () => void | Promise<void>;
  tasks: DraftTask[];
  sessions: Session[];
  isDraggable?: boolean;
  isDragOver?: boolean;
  isDragOverBottom?: boolean;
  onDragStart?: (projectId: string) => void;
  onDragOver?: (projectId: string) => void;
  onDrop?: (projectId: string) => void;
  onDragEnd?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Partial<DraftProject>>({});
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"about" | "budget" | "sessions" | "tasks">("about");
  const readonly = planAccepted || !canEdit;
  const { openPanel, closePanel } = useRightPanel();
  const canCreateSession = usePermission("sessions.create");
  const canEditSession = usePermission("sessions.edit");
  const canDeleteSession = usePermission("sessions.delete");
  const canCreateTask = usePermission("tasks.create");
  const canEditAnyTask = usePermission("tasks.editAny");
  const canDeleteAnyTask = usePermission("tasks.deleteAny");

  function openSessionPanel(session?: Session) {
    openPanel(
      session ? "Edit session" : "New session",
      <SessionForm
        clientId={clientId}
        projectId={project.id}
        session={session}
        onSaved={onSessionsChanged}
        onClose={closePanel}
      />
    );
  }

  async function deleteSession(s: Session) {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    const res = await fetch(
      `/api/clients/${clientId}/projects/${project.id}/sessions/${s.id}`,
      { method: "DELETE" }
    );
    if (res.ok) await onSessionsChanged();
  }

  const display: DraftProject = useMemo(() => ({ ...project, ...pending }), [project, pending]);
  const dirty = Object.keys(pending).length > 0;

  function setField<K extends keyof DraftProject>(field: K, value: DraftProject[K]) {
    setPending((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSection(key: SectionKey) {
    const current = display.hiddenSections ?? [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    setField("hiddenSections", next);
  }

  function discard() {
    setPending({});
    setEditorKey((k) => k + 1);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({
          title: updated.title,
          description: updated.description ?? null,
          why: updated.why ?? null,
          how: updated.how ?? null,
          what: updated.what ?? null,
          activities: updated.activities ?? null,
          deliverables: updated.deliverables ?? null,
          hiddenSections: updated.hiddenSections ?? [],
          soldPrice: updated.soldPrice ?? null,
          pricingMode: updated.pricingMode ?? "manual",
          roleAllocation: updated.roleAllocation ?? [],
          scheduledStartDate: updated.scheduledStartDate ?? null,
          scheduledEndDate: updated.scheduledEndDate ?? null,
        });
        setPending({});
        setEditorKey((k) => k + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  function attemptToggle() {
    if (open && dirty) {
      if (!confirm("You have unsaved changes in this draft. Discard them and collapse?")) return;
      discard();
    }
    setOpen(!open);
  }

  async function handleRemove() {
    if (!confirm(`Remove "${display.title}" from this plan? Its tasks and sessions will be deleted.`)) return;
    const res = await fetch(`/api/clients/${clientId}/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) onRemove();
  }

  const subtotal = calculateProjectSubtotal(display);
  const payout = calculateProjectPayout(display);
  const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
  const hiddenSet = new Set(display.hiddenSections ?? []);

  const dragFromHandle = useRef(false);
  const handleHeaderDragStart = useCallback((e: React.DragEvent) => {
    if (!dragFromHandle.current) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    onDragStart?.(project.id);
  }, [project.id, onDragStart]);

  const dragBorderStyle =
    isDragOver && isDraggable
      ? isDragOverBottom
        ? { borderBottom: "2px solid var(--primary)" }
        : { borderTop: "2px solid var(--primary)" }
      : undefined;

  const TABS: Array<{ key: typeof tab; label: string; count?: number }> = [
    { key: "about", label: "About" },
    { key: "budget", label: "Budget" },
    { key: "sessions", label: "Sessions", count: sessions.length },
    { key: "tasks", label: "Tasks", count: topLevelTasks.length },
  ];

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
      <div
        className={`sticky top-0 z-20 group ${open ? "border-b rounded-t-xl" : "rounded-xl"}`}
        style={{
          position: "sticky",
          top: 0,
          borderColor: "var(--border)",
          background: "var(--bg-surface)",
          ...dragBorderStyle,
        }}
        draggable={isDraggable}
        onMouseDown={() => { dragFromHandle.current = false; }}
        onDragStart={isDraggable ? handleHeaderDragStart : undefined}
        onDragOver={isDraggable && onDragOver ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOver(project.id);
        } : undefined}
        onDrop={isDraggable && onDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDrop(project.id); } : undefined}
        onDragEnd={isDraggable && onDragEnd ? (e) => { e.stopPropagation(); dragFromHandle.current = false; onDragEnd(); } : undefined}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          {isDraggable && (
            <div
              className="flex-shrink-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing"
              style={{ color: "var(--text-muted)" }}
              onMouseDown={(e) => { e.stopPropagation(); dragFromHandle.current = true; }}
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </div>
          )}
          <button
            type="button"
            onClick={attemptToggle}
            className="flex items-center gap-2 flex-1 min-w-0 text-left p-1 -m-1 rounded-md hover:bg-[var(--bg-hover)]"
          >
            <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span
              className="block text-base font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {display.title || "Untitled project"}
            </span>
          </button>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
              {formatEuro(subtotal)}
            </span>
            {payout > 0 && (
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--text-muted)" }}
                title="Pay-out to externals · Actual revenue (internal only)"
              >
                − {formatEuro(payout)} ext · {formatEuro(subtotal - payout)} net
              </span>
            )}
          </div>
          {open && !readonly && dirty && (
            <>
              <button
                onClick={discard}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs btn-ghost shrink-0"
                title="Discard changes"
              >
                <X size={12} />
                Discard
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs btn-primary shrink-0 disabled:opacity-50"
              >
                <Check size={12} />
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
          {!readonly && (
            <button
              onClick={handleRemove}
              className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
              title="Remove from plan"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        {open && (
          <div className="flex gap-1 px-3 pb-0">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="px-3 py-2 text-xs font-medium border-b-2 transition-colors"
                  style={{
                    color: active ? "var(--primary)" : "var(--text-muted)",
                    borderColor: active ? "var(--primary)" : "transparent",
                  }}
                >
                  {t.label}
                  {typeof t.count === "number" && t.count > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center justify-center text-[10px] rounded-full px-1.5"
                      style={{
                        background: active ? "var(--brand-light, var(--primary-light))" : "var(--bg-hover)",
                        color: active ? "var(--primary)" : "var(--text-muted)",
                      }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div className="px-4 py-4 space-y-5">
          {tab === "about" && (
            <>
              <div>
                <label className="typo-label">Project name</label>
                <input
                  type="text"
                  value={display.title}
                  disabled={readonly}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Project name"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="typo-label">Scheduled start</label>
                  <input
                    type="date"
                    value={display.scheduledStartDate ?? ""}
                    disabled={readonly}
                    onChange={(e) => setField("scheduledStartDate", e.target.value || null)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="typo-label">Scheduled end</label>
                  <input
                    type="date"
                    value={display.scheduledEndDate ?? ""}
                    disabled={readonly}
                    onChange={(e) => setField("scheduledEndDate", e.target.value || null)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
              {SECTION_KEYS.map((field) => {
                const hidden = hiddenSet.has(field);
                return (
                  <div key={field}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="typo-label capitalize mb-0">{field}</label>
                      {!readonly && (
                        <button
                          onClick={() => toggleSection(field)}
                          className="flex items-center gap-1 text-xs btn-tertiary"
                          title={hidden ? "Show this section in the overview" : "Hide this section from the overview"}
                        >
                          {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                          {hidden ? "Hidden" : "Visible"}
                        </button>
                      )}
                    </div>
                    {hidden ? (
                      <div
                        className="rounded-button border px-3 py-2 text-xs italic"
                        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                      >
                        Hidden from overview &mdash; content preserved. Click &ldquo;Hidden&rdquo; above to re-enable.
                      </div>
                    ) : (
                      <RichTextEditor
                        key={`${field}-${editorKey}`}
                        content={display[field] ?? ""}
                        onChange={(html) => setField(field, html)}
                        placeholder={`Describe the ${field}…`}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {tab === "budget" && (
            <>
              <RoleAllocationEditor
                pricingMode={display.pricingMode}
                allocation={display.roleAllocation}
                projectRoles={projectRoles}
                assignableUsers={assignableUsers}
                readonly={readonly}
                onChange={(allocation, pricingMode) => {
                  setPending((prev) => ({ ...prev, roleAllocation: allocation, pricingMode }));
                }}
              />
              {display.pricingMode === "manual" && (
                <div>
                  <label className="typo-label">Sold price (EUR)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={display.soldPrice ?? ""}
                    disabled={readonly}
                    onChange={(e) => setField("soldPrice", e.target.value === "" ? null : Number(e.target.value))}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              )}
            </>
          )}

          {tab === "sessions" && (
            <div>
              {sessions.length > 0 ? (
                <ul className="text-sm space-y-1 mb-3">
                  {sessions.map((s) => {
                    const editable = !readonly && canEditSession;
                    const deletable = !readonly && canDeleteSession;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 group"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => openSessionPanel(s)}
                            className="flex-1 text-left truncate hover:underline"
                          >
                            {s.title}
                            {s.date && (
                              <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                                · {fmtDate(s.date)}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="flex-1 truncate">
                            {s.title}
                            {s.date && (
                              <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                                · {fmtDate(s.date)}
                              </span>
                            )}
                          </span>
                        )}
                        {editable && (
                          <button
                            type="button"
                            onClick={() => openSessionPanel(s)}
                            className="p-1 rounded-md btn-icon opacity-0 group-hover:opacity-100"
                            title="Edit session"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {deletable && (
                          <button
                            type="button"
                            onClick={() => deleteSession(s)}
                            className="p-1 rounded-md btn-icon text-[var(--danger)] opacity-0 group-hover:opacity-100"
                            title="Delete session"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                  No sessions yet.
                </p>
              )}
              {!readonly && canCreateSession && (
                <button
                  type="button"
                  onClick={() => openSessionPanel()}
                  className="flex items-center gap-1.5 text-xs btn-tertiary"
                >
                  <Plus size={12} />
                  New session
                </button>
              )}
            </div>
          )}

          {tab === "tasks" && (
            <div>
              <p
                className="text-xs mb-3 px-2.5 py-1.5 rounded-md inline-block"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
              >
                Tasks are never shared with the client — they&apos;re for your team only.
              </p>
              <DraftTasksList
                clientId={clientId}
                projectId={project.id}
                tasks={tasks}
                users={assignableUsers}
                readonly={readonly}
                canCreateTask={canCreateTask}
                canEditAnyTask={canEditAnyTask}
                canDeleteAnyTask={canDeleteAnyTask}
                onTasksChanged={onTasksChanged}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  const [data, setData] = useState<ApiResponse | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string; image: string | null }[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"projects" | "content" | "settings">("projects");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
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

  const discountAmount = useMemo(() => {
    if (!plan?.discountType || plan.discountValue == null) return 0;
    if (plan.discountType === "percentage") return subtotal * (plan.discountValue / 100);
    return plan.discountValue;
  }, [plan, subtotal]);

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

  async function handleProjectDrop(dropTargetId: string) {
    const fromId = draggingProjectId;
    setDraggingProjectId(null);
    setDragOverProjectId(null);
    if (!fromId || fromId === dropTargetId) return;
    if (!data) return;
    const current = data.projects;
    const fromIdx = current.findIndex((p) => p.id === fromId);
    const toIdx = current.findIndex((p) => p.id === dropTargetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...current];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const prevProjects = current;
    setData((d) => (d ? { ...d, projects: next } : d));

    const res = await fetch(
      `/api/clients/${clientId}/plans/${planId}/projects/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      }
    );
    if (!res.ok) {
      setData((d) => (d ? { ...d, projects: prevProjects } : d));
    }
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
    <div className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2" style={{ borderColor: "var(--border)" }}>
      {([
        { value: "projects", label: "Projects" },
        { value: "content", label: "About" },
        { value: "settings", label: "Settings" },
      ] as const).map(({ value, label }) => {
        const active = activeTab === value;
        return (
          <button
            key={value}
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
          <p className="text-sm p-7" style={{ color: "var(--text-muted)" }}>Loading plan…</p>
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
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="typo-card-title" style={{ color: "var(--success)" }}>
                Plan accepted
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>
                {acceptorName
                  ? `${acceptorName} (${acceptorSourceLabel}) accepted on ${fmtDate(plan.acceptedAt)}.`
                  : `Accepted on ${fmtDate(plan.acceptedAt)}.`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canAccept && (
                <button
                  type="button"
                  onClick={revokePlan}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
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
                <div className="space-y-4">
                  {projects.map((p, idx) => {
                    const fromIdx = draggingProjectId
                      ? projects.findIndex((x) => x.id === draggingProjectId)
                      : -1;
                    const isDragOverBottom =
                      dragOverProjectId === p.id && fromIdx !== -1 && fromIdx < idx;
                    return (
                      <DraftCard
                        key={p.id}
                        project={p}
                        clientId={clientId}
                        planAccepted={planAccepted}
                        projectRoles={projectRoles}
                        assignableUsers={assignableUsers}
                        canEdit={canEdit}
                        onUpdate={(patch) => updateProject(p.id, patch)}
                        onRemove={() => removeProject(p.id)}
                        onSessionsChanged={() => refreshSessions(p.id)}
                        onTasksChanged={() => refreshTasks(p.id)}
                        tasks={data!.tasksByProject[p.id] ?? []}
                        sessions={data!.sessionsByProject[p.id] ?? []}
                        isDraggable={canEdit && !planAccepted && projects.length > 1}
                        isDragOver={dragOverProjectId === p.id && draggingProjectId !== p.id}
                        isDragOverBottom={isDragOverBottom}
                        onDragStart={(id) => setDraggingProjectId(id)}
                        onDragOver={(id) => setDragOverProjectId(id)}
                        onDrop={handleProjectDrop}
                        onDragEnd={() => {
                          setDraggingProjectId(null);
                          setDragOverProjectId(null);
                        }}
                      />
                    );
                  })}
                </div>
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
                  Plan-wide discount and VAT. The Budget card on the right recomputes totals as you change these.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="typo-label">Discount type</label>
                    <select
                      value={plan.discountType ?? ""}
                      disabled={planAccepted || !canEdit}
                      onChange={(e) => patchPlan({ discountType: e.target.value || null })}
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="">No discount</option>
                      <option value="percentage">Percentage</option>
                      <option value="amount">Amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="typo-label">
                      Discount value{plan.discountType === "percentage" ? " (%)" : plan.discountType === "amount" ? " (EUR)" : ""}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={plan.discountType === "percentage" ? 1 : 100}
                      value={plan.discountValue ?? ""}
                      disabled={planAccepted || !canEdit || !plan.discountType}
                      onChange={(e) =>
                        patchPlanDebounced(
                          { discountValue: e.target.value === "" ? null : Number(e.target.value) },
                          "discountValue"
                        )
                      }
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
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
            {plan.discountType && discountAmount > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>
                  Discount {plan.discountType === "percentage" ? `(${plan.discountValue}%)` : ""}
                </span>
                <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>− {formatEuro(discountAmount)}</span>
              </div>
            )}
            {plan.discountType && discountAmount > 0 && (
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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium btn-secondary border"
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
