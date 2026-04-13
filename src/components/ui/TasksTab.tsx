"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Project, Task } from "@/types";
import {
  TaskRow,
  InlineTaskInput,
  TaskForm,
  UserOption,
} from "@/components/ui/task-row";
import KickOffProjectButton from "@/components/ui/KickOffProjectButton";

export { TaskForm } from "@/components/ui/task-row";

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--primary)" }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
        {completed}/{total}
      </span>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  completed,
  total,
  accent,
  overdueCount,
}: {
  label: string;
  count: number;
  completed?: number;
  total?: number;
  accent?: string;
  overdueCount?: number;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="typo-metric" style={{ color: accent ?? "var(--text-primary)" }}>
          {count}
        </p>
        {overdueCount !== undefined && overdueCount > 0 && (
          <span className="text-xs tabular-nums" style={{ color: "var(--destructive)" }}>
            {overdueCount} overdue
          </span>
        )}
      </div>
      {completed !== undefined && total !== undefined && total > 0 && (
        <ProgressBar completed={completed} total={total} />
      )}
    </div>
  );
}

// ── Delivery stat card ─────────────────────────────────────────────────────────

function DeliveryStatCard({
  deliveryDate,
  deliveryTask,
  projectCompletedDate,
  today: todayProp,
}: {
  deliveryDate: string | undefined;
  deliveryTask: Task | null | undefined; // undefined = still loading
  projectCompletedDate?: string;
  today?: string;
}) {
  if (!deliveryDate && !projectCompletedDate) {
    return (
      <div
        className="flex flex-col gap-1.5 rounded-xl border p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Delivery</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No date set</p>
      </div>
    );
  }

  // Delivered: project has a completedDate (user-adjustable) or delivery task was ticked off
  const deliveredRawDate = projectCompletedDate ?? (deliveryTask?.completedAt ? deliveryTask.completedAt : undefined);
  if (deliveredRawDate) {
    const parsedDate = projectCompletedDate
      ? new Date(projectCompletedDate + "T00:00:00")
      : new Date(deliveredRawDate);
    const deliveredOn = parsedDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return (
      <div
        className="flex flex-col gap-1.5 rounded-xl border p-4"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Delivery</p>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={18} style={{ color: "var(--primary)" }} />
          <p className="text-xl font-semibold" style={{ color: "var(--primary)" }}>
            Delivered
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{deliveredOn}</p>
      </div>
    );
  }

  if (!deliveryDate) return null;

  const today = todayProp ?? new Date().toISOString().slice(0, 10);
  // Use UTC-neutral day diff (date strings only, no TZ issues)
  const [dy, dm, dd] = deliveryDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const deliveryMs = Date.UTC(dy, dm - 1, dd);
  const todayMs = Date.UTC(ty, tm - 1, td);
  const daysUntil = Math.round((deliveryMs - todayMs) / (1000 * 60 * 60 * 24));

  const formattedDate = new Date(deliveryDate + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Date reached but not yet delivered
  if (daysUntil <= 0) {
    const overdueDays = Math.abs(daysUntil);
    return (
      <div
        className="flex flex-col gap-1.5 rounded-xl border p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Delivery</p>
        <div className="flex items-center gap-1.5">
          <AlertCircle size={18} style={{ color: "var(--warning)" }} />
          <p className="text-xl font-semibold" style={{ color: "var(--warning)" }}>
            {overdueDays === 0 ? "Due today" : `${overdueDays}d overdue`}
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Tick off the delivery task below
        </p>
      </div>
    );
  }

  // Countdown
  const isUrgent = daysUntil <= 7;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Delivery</p>
      <div className="flex items-baseline gap-1.5">
        <p
          className="typo-metric"
          style={{ color: isUrgent ? "var(--warning)" : "var(--text-primary)" }}
        >
          {daysUntil}
        </p>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          day{daysUntil !== 1 ? "s" : ""} to go
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formattedDate}</p>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="typo-section-header mb-3"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </p>
  );
}

// ── TasksTab ───────────────────────────────────────────────────────────────────

export default function TasksTab({
  projectId,
  clientId,
  initialTasks,
  currentUserId,
  project,
  today: todayProp,
  canEditAnyTask = true,
  canEditOwnTask = true,
  canDeleteAnyTask = true,
  canDeleteOwnTask = true,
}: {
  projectId: string;
  clientId: string;
  initialTasks: Task[];
  currentUserId: string;
  project: Project | null;
  today?: string;
  canEditAnyTask?: boolean;
  canEditOwnTask?: boolean;
  canDeleteAnyTask?: boolean;
  canDeleteOwnTask?: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const taskCanEdit = (task: Task) => canEditAnyTask || (canEditOwnTask && task.createdById === currentUserId);
  const taskCanDelete = (task: Task) => canDeleteAnyTask || (canDeleteOwnTask && task.createdById === currentUserId);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // undefined = loading, null = no task, Task = found
  const [deliveryTask, setDeliveryTask] = useState<Task | null | undefined>(undefined);
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();

  // Sync local task state when server re-renders (e.g. after router.refresh())
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Delivery task: find in project tasks or auto-create when date is reached
  const deliveryTitle = project?.title ? `Deliver ${project.title}` : "";
  const deliveryCreating = useRef(false);
  useEffect(() => {
    if (!project?.deliveryDate) {
      setDeliveryTask(null);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    // Search project tasks (from server-rendered initial data)
    const found = initialTasks.find((t) => t.title === deliveryTitle);
    if (found) {
      setDeliveryTask(found);
      return;
    }

    // Auto-create when delivery date has been reached
    if (project.deliveryDate <= today && !deliveryCreating.current) {
      deliveryCreating.current = true;
      fetch(`/api/clients/${clientId}/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: deliveryTitle }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((created) => {
          if (created) {
            setDeliveryTask(created);
            setTasks((prev) => [...prev, created]);
          } else {
            setDeliveryTask(null);
          }
        })
        .catch(() => setDeliveryTask(null))
        .finally(() => { deliveryCreating.current = false; });
    } else if (project.deliveryDate > today) {
      setDeliveryTask(null);
    }
  }, [clientId, projectId, initialTasks, deliveryTitle, project?.deliveryDate]);

  const userImages = useMemo(
    () => Object.fromEntries(users.filter((u) => u.image).map((u) => [u.id, u.image!])),
    [users]
  );

  const topLevel = tasks.filter((t) => !t.parentTaskId);
  const subtasksOf = useCallback(
    (id: string) => tasks.filter((t) => t.parentTaskId === id),
    [tasks]
  );

  // A top-level task is "fully completed" when the task itself is done and all subtasks are done
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
  const completedTopLevel = topLevel.filter((t) => isFullyCompleted(t));

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
    // Auto-expand parent when adding a subtask
    if (saved.parentTaskId) {
      setExpandedIds((prev) => new Set([...prev, saved.parentTaskId!]));
    }
    router.refresh();
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
    // stays open — user can add another task
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
    const completed = !task.completedAt;
    // For top-level tasks, cascade to all subtasks
    const affected = task.parentTaskId ? [task] : [task, ...subtasksOf(task.id)];

    // Optimistic update for all affected tasks
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => {
        if (!affected.some((a) => a.id === t.id)) return t;
        return { ...t, completedAt: completed ? now : undefined, completedById: undefined, completedByName: undefined };
      })
    );

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
      router.refresh();
    } else {
      // Revert all on any failure
      setTasks((prev) => prev.map((t) => affected.find((a) => a.id === t.id) ?? t));
    }
  }

  async function handleDelete(taskId: string, hasSubtasks: boolean) {
    const msg = hasSubtasks
      ? "Delete this task and all its subtasks? This cannot be undone."
      : "Delete this task? This cannot be undone.";
    if (!confirm(msg)) return;

    // Optimistic removal
    setTasks((prev) => prev.filter((t) => t.id !== taskId && t.parentTaskId !== taskId));

    const res = await fetch(
      `/api/clients/${clientId}/projects/${projectId}/tasks/${taskId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      // Re-fetch on failure
      const refetch = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks`);
      if (refetch.ok) setTasks(await refetch.json());
    }
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
  }

  async function moveSubtask(subtaskId: string, newParentId: string, insertBeforeId?: string) {
    const subtask = tasks.find((t) => t.id === subtaskId);
    const newParent = tasks.find((t) => t.id === newParentId);
    if (!subtask || !newParent) return;

    // Optimistic: update parentTaskId + inherit assignees from new parent
    setTasks((prev) =>
      prev.map((t) =>
        t.id === subtaskId
          ? { ...t, parentTaskId: newParentId, assignees: newParent.assignees }
          : t
      )
    );
    // Auto-expand the new parent
    setExpandedIds((prev) => new Set([...prev, newParentId]));

    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentTaskId: newParentId }),
    });
    if (!res.ok) {
      // Revert
      setTasks((prev) => prev.map((t) => (t.id === subtaskId ? subtask : t)));
      return;
    }
    const saved = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === subtaskId ? saved : t)));

    // If dropped onto a sibling, reorder so the moved subtask is before it
    if (insertBeforeId) {
      await reorderSubtasks(subtaskId, insertBeforeId, newParentId);
    }
  }

  async function handleDrop(dropTargetId: string) {
    const fromId = draggingId;
    if (!fromId || fromId === dropTargetId) return;
    setDraggingId(null);
    setDragOverId(null);

    const dragging = tasks.find((t) => t.id === fromId);
    const target = tasks.find((t) => t.id === dropTargetId);
    if (!dragging || !target) return;

    // Tasks with children may not be nested as subtasks
    const draggingHasChildren = subtasksOf(fromId).length > 0;

    if (!dragging.parentTaskId && !target.parentTaskId) {
      // Top-level → top-level: reorder
      await reorderTopLevel(fromId, dropTargetId);
    } else if (!draggingHasChildren && dragging.parentTaskId && !target.parentTaskId) {
      // Subtask dropped on top-level task header: move to that parent (append)
      await moveSubtask(fromId, dropTargetId);
    } else if (!draggingHasChildren && dragging.parentTaskId && target.parentTaskId) {
      if (dragging.parentTaskId === target.parentTaskId) {
        // Same parent: reorder subtasks
        await reorderSubtasks(fromId, dropTargetId, dragging.parentTaskId);
      } else {
        // Different parent: move subtask, insert before the target subtask
        await moveSubtask(fromId, target.parentTaskId, dropTargetId);
      }
    }
  }

  const today = todayProp ?? new Date().toISOString().slice(0, 10);
  const allOpen = tasks.filter((t) => !t.completedAt);
  const allCompleted = tasks.filter((t) => t.completedAt);
  const myTasks = tasks.filter((t) => t.assignees.some((a) => a.userId === currentUserId));
  const myOpen = myTasks.filter((t) => !t.completedAt);
  const myCompleted = myTasks.filter((t) => t.completedAt);
  const overdueAll = allOpen.filter((t) => t.completionDate && t.completionDate < today).length;
  const overdueMe = myOpen.filter((t) => t.completionDate && t.completionDate < today).length;

  return (
    <div className="max-w-3xl">
      {/* Upcoming banner — shown when project has not been kicked off yet */}
      {project && !project.kickedOffAt && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border mb-6"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This project hasn&apos;t been kicked off yet. Tasks won&apos;t appear on the client board until kick-off.
          </p>
          <div className="shrink-0">
            <KickOffProjectButton project={project} clientId={clientId} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={`grid gap-4 mb-8 ${project?.kickedOffAt ? "grid-cols-3" : "grid-cols-2"}`}>
        <StatCard
          label="All open tasks"
          count={allOpen.length}
          completed={allCompleted.length}
          total={tasks.length}
          overdueCount={overdueAll}
        />
        <StatCard
          label="Open for you"
          count={myOpen.length}
          completed={myCompleted.length}
          total={myTasks.length}
          overdueCount={overdueMe}
        />
        {project?.kickedOffAt && (
          <DeliveryStatCard
            deliveryDate={project?.deliveryDate}
            deliveryTask={deliveryTask}
            projectCompletedDate={project?.completedDate}
            today={today}
          />
        )}
      </div>

      {/* Open tasks section */}
      <SectionLabel>Open tasks</SectionLabel>

      {/* Empty state */}
      {openTopLevel.length === 0 && !showInlineAdd && (
        <div className="flex items-center justify-center h-24 mb-2">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No open tasks.
          </p>
        </div>
      )}

      {/* Open task list */}
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
              canEdit={taskCanEdit(task)}
              canDelete={taskCanDelete(task)}
              titlePrefix={task.title === deliveryTitle ? "Deliver:" : undefined}
              displayTitle={task.title === deliveryTitle ? project!.title : undefined}
              today={today}
              isDraggable={taskCanEdit(task)}
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

      {/* + New task */}
      <div className="mt-2 mb-10">
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

      {/* Completed tasks section */}
      {completedTopLevel.length > 0 && (
        <>
          <SectionLabel>Completed tasks</SectionLabel>
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
                canEdit={taskCanEdit(task)}
                canDelete={taskCanDelete(task)}
                titlePrefix={task.title === deliveryTitle ? "Deliver:" : undefined}
                displayTitle={task.title === deliveryTitle ? project!.title : undefined}
                today={today}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
