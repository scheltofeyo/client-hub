"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Task, Project } from "@/types";
import {
  TaskRow,
  InlineTaskInput,
  TaskForm,
  UserOption,
} from "@/components/ui/task-row";

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
}: {
  label: string;
  count: number;
  completed?: number;
  total?: number;
  accent?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: accent ?? "var(--text-primary)" }}>
        {count}
      </p>
      {completed !== undefined && total !== undefined && total > 0 && (
        <ProgressBar completed={completed} total={total} />
      )}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  tasks,
  clientId,
  projectId,
  users,
  currentUserId,
  showCompleted,
  onToggleComplete,
  onTaskSaved,
  onDelete,
}: {
  title: string;
  badge?: React.ReactNode;
  tasks: Task[];
  clientId: string;
  projectId?: string;
  users: UserOption[];
  currentUserId: string;
  showCompleted: boolean;
  onToggleComplete: (task: Task) => void;
  onTaskSaved: (t: Task) => void;
  onDelete: (taskId: string) => void;
}) {
  const { openPanel, closePanel } = useRightPanel();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<Record<string, number>>({});

  const userImages = useMemo(
    () => Object.fromEntries(users.filter((u) => u.image).map((u) => [u.id, u.image!])),
    [users]
  );

  const topLevelTasks = tasks
    .filter((t) => !t.parentTaskId)
    .filter((t) => showCompleted || !t.completedAt)
    .sort((a, b) => {
      // completed tasks always last
      const doneSort = Number(!!a.completedAt) - Number(!!b.completedAt);
      if (doneSort !== 0) return doneSort;
      // among incomplete tasks, sort by order (with localOrder overrides)
      const aOrder = !a.completedAt ? (localOrder[a.id] ?? a.order ?? 0) : 0;
      const bOrder = !b.completedAt ? (localOrder[b.id] ?? b.order ?? 0) : 0;
      return aOrder - bOrder;
    });
  const openCount = topLevelTasks.filter((t) => !t.completedAt).length;
  const today = new Date().toISOString().slice(0, 10);
  const hasOverdue = topLevelTasks.some((t) => !t.completedAt && t.completionDate && t.completionDate < today) ||
    tasks.some((t) => !t.completedAt && t.completionDate && t.completionDate < today);

  function getSubtasks(parentId: string) {
    return tasks.filter((t) => t.parentTaskId === parentId);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function openEditTask(task: Task) {
    const parentTask = task.parentTaskId ? tasks.find((t) => t.id === task.parentTaskId) : undefined;
    openPanel("Edit Task", (
      <TaskForm
        clientId={clientId}
        projectId={task.projectId}
        task={task}
        parentTaskTitle={parentTask?.title}
        isSubtask={!!task.parentTaskId}
        parentAssignees={parentTask?.assignees}
        users={users}
        onSaved={onTaskSaved}
        onClose={closePanel}
      />
    ));
  }

  const reorderUrl = projectId
    ? `/api/clients/${clientId}/projects/${projectId}/tasks/reorder`
    : `/api/clients/${clientId}/tasks/reorder`;

  async function reorderTopLevel(fromId: string, toId: string) {
    if (fromId === toId) return;
    const openTasks = topLevelTasks.filter((t) => !t.completedAt);
    const reordered = [...openTasks];
    const fromIdx = reordered.findIndex((t) => t.id === fromId);
    const toIdx = reordered.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const newLocalOrder = Object.fromEntries(reordered.map((t, i) => [t.id, i]));
    setLocalOrder((prev) => ({ ...prev, ...newLocalOrder }));
    await fetch(reorderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((t) => t.id) }),
    });
  }

  async function reorderSubtasks(fromId: string, toId: string, parentId: string) {
    const siblings = tasks
      .filter((t) => t.parentTaskId === parentId && !t.completedAt)
      .sort((a, b) => (localOrder[a.id] ?? a.order ?? 0) - (localOrder[b.id] ?? b.order ?? 0));
    const fromIdx = siblings.findIndex((t) => t.id === fromId);
    const toIdx = siblings.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const newLocalOrder = Object.fromEntries(reordered.map((t, i) => [t.id, i]));
    setLocalOrder((prev) => ({ ...prev, ...newLocalOrder }));
    // Optimistically update task.order in parent state so TaskRow re-sorts subtasks immediately
    for (const t of reordered) {
      onTaskSaved({ ...t, order: newLocalOrder[t.id] });
    }
    await fetch(reorderUrl, {
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
    onTaskSaved({ ...subtask, parentTaskId: newParentId, assignees: newParent.assignees });
    setExpandedIds((prev) => new Set([...prev, newParentId]));

    const patchUrl = projectId
      ? `/api/clients/${clientId}/projects/${projectId}/tasks/${subtaskId}`
      : `/api/clients/${clientId}/tasks/${subtaskId}`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentTaskId: newParentId }),
    });
    if (!res.ok) {
      onTaskSaved(subtask);
      return;
    }
    const saved = await res.json();
    onTaskSaved(saved);

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
    const draggingHasChildren = getSubtasks(fromId).length > 0;

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

  async function createTask(titleStr: string) {
    const url = projectId
      ? `/api/clients/${clientId}/projects/${projectId}/tasks`
      : `/api/clients/${clientId}/tasks`;
    const currentUser = users.find((u) => u.id === currentUserId);
    const assignees = currentUser
      ? [{ userId: currentUser.id, name: currentUser.name, ...(currentUser.image ? { image: currentUser.image } : {}) }]
      : [];
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleStr, assignees }),
    });
    if (res.ok) {
      const created = await res.json();
      onTaskSaved(created);
    }
  }

  async function createSubtask(parentTask: Task, title: string) {
    const url = parentTask.projectId
      ? `/api/clients/${clientId}/projects/${parentTask.projectId}/tasks`
      : `/api/clients/${clientId}/tasks`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parentTaskId: parentTask.id }),
    });
    if (res.ok) {
      onTaskSaved(await res.json());
    }
    setInlineSubtaskFor(null);
  }

  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-[var(--bg-hover)] rounded-lg"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </span>
        <span className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>{title}</span>
          {badge}
          {hasOverdue && (
            <AlertTriangle size={13} style={{ color: "#f97316", flexShrink: 0 }} />
          )}
        </span>
        <span
          className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium tabular-nums"
          style={{ background: "var(--border)", color: "var(--text-muted)" }}
        >
          {openCount} open
        </span>
      </button>

      {/* Task list */}
      {!collapsed && (
        <div className="px-2 pb-2">
          {topLevelTasks.length === 0 && !showInlineAdd ? (
            <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>No tasks yet.</p>
          ) : (
            topLevelTasks.map((task) => {
              const openTasks = topLevelTasks.filter((t) => !t.completedAt);
              const fromIdx = draggingId ? openTasks.findIndex((t) => t.id === draggingId) : -1;
              const thisIdx = openTasks.findIndex((t) => t.id === task.id);
              const isDragOverBottom = dragOverId === task.id && fromIdx !== -1 && fromIdx < thisIdx;
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  subtasks={getSubtasks(task.id)}
                  isExpanded={expandedIds.has(task.id)}
                  onToggleExpand={() => toggleExpand(task.id)}
                  onToggleComplete={onToggleComplete}
                  onEdit={openEditTask}
                  onAddSubtask={(parentTaskId) => {
                    setInlineSubtaskFor(parentTaskId);
                    if (!expandedIds.has(parentTaskId)) toggleExpand(parentTaskId);
                  }}
                  onDelete={(taskId, _hasSubtasks) => onDelete(taskId)}
                  showInlineSubtask={inlineSubtaskFor === task.id}
                  onInlineSubtaskSave={(title) => createSubtask(task, title)}
                  onInlineSubtaskCancel={() => setInlineSubtaskFor(null)}
                  userImages={userImages}
                  onViewInLogbook={task.logId ? () => router.push(`/clients/${clientId}?tab=Logbook`) : undefined}
                  isDraggable={!task.completedAt}
                  draggingId={draggingId}
                  draggingHasChildren={!!draggingId && getSubtasks(draggingId).length > 0}
                  dragOverId={dragOverId}
                  isDragOverBottom={isDragOverBottom}
                  onDragStart={(id) => setDraggingId(id)}
                  onDragOver={(id) => setDragOverId(id)}
                  onDrop={handleDrop}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                />
              );
            })
          )}
          {showInlineAdd ? (
            <InlineTaskInput
              onSave={async (t) => { await createTask(t); setShowInlineAdd(false); }}
              onCancel={() => setShowInlineAdd(false)}
            />
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm py-2 px-2 rounded-lg btn-tertiary"
              onClick={() => setShowInlineAdd(true)}
            >
              <Plus size={13} />
              New task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ClientTasksTab({
  clientId,
  projects,
  initialGeneralTasks,
  initialProjectTasks,
  currentUserId,
}: {
  clientId: string;
  projects: Pick<Project, "id" | "title" | "status">[];
  initialGeneralTasks: Task[];
  initialProjectTasks: Record<string, Task[]>;
  currentUserId: string;
}) {
  const [generalTasks, setGeneralTasks] = useState<Task[]>(initialGeneralTasks);
  const [projectTaskMap, setProjectTaskMap] = useState<Record<string, Task[]>>(initialProjectTasks);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => r.json())
      .then((data) => setUsers(data))
      .catch(() => {});
  }, []);

  // Merge all tasks for stats
  const allTasks = useMemo(() => {
    const projectTasks = Object.values(projectTaskMap).flat();
    return [...generalTasks, ...projectTasks];
  }, [generalTasks, projectTaskMap]);

  const today = new Date().toISOString().slice(0, 10);

  // Project sections only show tasks assigned to the current user
  function myProjectTasks(tasks: Task[]) {
    return tasks.filter((t) => t.assignees.some((a) => a.userId === currentUserId));
  }

  const allOpen = allTasks.filter((t) => !t.completedAt);
  const allCompleted = allTasks.filter((t) => t.completedAt);
  const myTasks = allTasks.filter((t) => t.assignees.some((a) => a.userId === currentUserId));
  const myOpen = myTasks.filter((t) => !t.completedAt);
  const myCompleted = myTasks.filter((t) => t.completedAt);
  const overdueCount = allTasks.filter(
    (t) => !t.completedAt && t.completionDate && t.completionDate < today
  ).length;

  function upsertTask(task: Task) {
    if (!task.projectId) {
      setGeneralTasks((prev) => {
        let next = prev;
        const exists = next.find((t) => t.id === task.id);
        if (exists) {
          next = next.map((t) => (t.id === task.id ? task : t));
        } else {
          next = [...next, task];
        }
        // Cascade assignees to child tasks when a parent task is updated
        if (!task.parentTaskId) {
          next = next.map((t) =>
            t.parentTaskId === task.id ? { ...t, assignees: task.assignees } : t
          );
        }
        return next;
      });
    } else {
      setProjectTaskMap((prev) => {
        const pid = task.projectId!;
        let next = prev[pid] ?? [];
        const found = next.find((t) => t.id === task.id);
        if (found) {
          next = next.map((t) => (t.id === task.id ? task : t));
        } else {
          next = [...next, task];
        }
        // Cascade assignees to child tasks when a parent task is updated
        if (!task.parentTaskId) {
          next = next.map((t) =>
            t.parentTaskId === task.id ? { ...t, assignees: task.assignees } : t
          );
        }
        return { ...prev, [pid]: next };
      });
    }
  }

  async function handleToggleComplete(task: Task) {
    const completed = !task.completedAt;
    const now = new Date().toISOString();

    // Optimistic update for parent
    const updated = completed
      ? { ...task, completedAt: now }
      : { ...task, completedAt: undefined, completedById: undefined, completedByName: undefined };
    upsertTask(updated);

    // If completing a top-level task, also optimistically mark all subtasks complete
    const subtasks = !task.parentTaskId ? allTasks.filter((t) => t.parentTaskId === task.id) : [];
    if (completed && subtasks.length > 0) {
      for (const sub of subtasks) {
        if (!sub.completedAt) upsertTask({ ...sub, completedAt: now });
      }
    }

    // PATCH parent
    const res = await fetch(`/api/clients/${clientId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (!res.ok) {
      upsertTask(task);
      return;
    }
    const data = await res.json();
    upsertTask(data);

    // PATCH subtasks in parallel (persist cascade)
    if (completed && subtasks.length > 0) {
      const subResults = await Promise.all(
        subtasks
          .filter((s) => !s.completedAt)
          .map((s) =>
            fetch(`/api/clients/${clientId}/tasks/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ completed: true }),
            }).then((r) => (r.ok ? r.json() : null))
          )
      );
      for (const saved of subResults) {
        if (saved) upsertTask(saved);
      }
    }
  }

  async function handleDelete(taskId: string) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistic remove task + its subtasks
    if (!task.projectId) {
      setGeneralTasks((prev) => prev.filter((t) => t.id !== taskId && t.parentTaskId !== taskId));
    } else {
      const pid = task.projectId;
      setProjectTaskMap((prev) => ({
        ...prev,
        [pid]: (prev[pid] ?? []).filter((t) => t.id !== taskId && t.parentTaskId !== taskId),
      }));
    }

    const res = await fetch(`/api/clients/${clientId}/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) {
      // On failure, re-fetch would be ideal but we skip for now
    }
  }

  // Projects with at least one open task assigned to me (or all projects when showAll)
  const projectsWithMyTasks = projects
    .filter((p) => {
      const projectTasks = projectTaskMap[p.id] ?? [];
      const relevant = showAll ? projectTasks : myProjectTasks(projectTasks);
      return relevant.some((t) => !t.completedAt && !t.parentTaskId);
    })
    .sort((a, b) => {
      // active before completed
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return 0;
    });

  return (
    <div className="max-w-3xl space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-2">
        <StatCard
          label="All open tasks"
          count={allOpen.length}
          completed={allCompleted.length}
          total={allTasks.length}
        />
        <StatCard
          label="Open for you"
          count={myOpen.length}
          completed={myCompleted.length}
          total={myTasks.length}
        />
        <StatCard
          label="Overdue"
          count={overdueCount}
          accent={overdueCount > 0 ? "var(--destructive, #ef4444)" : undefined}
        />
      </div>

      {/* Toggles row */}
      <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button
          type="button"
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
          style={{ background: "transparent", borderRight: "1px solid var(--border)" }}
          onClick={() => setShowCompleted((v) => !v)}
        >
          <div
            className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
            style={{ background: showCompleted ? "var(--primary)" : "var(--border)" }}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
              style={{ background: "white", left: showCompleted ? "calc(100% - 14px)" : "2px" }}
            />
          </div>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>Show completed</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
          style={{ background: "transparent" }}
          onClick={() => setShowAll((v) => !v)}
        >
          <div
            className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
            style={{ background: showAll ? "var(--primary)" : "var(--border)" }}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
              style={{ background: "white", left: showAll ? "calc(100% - 14px)" : "2px" }}
            />
          </div>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>Show everyone&apos;s tasks</span>
        </button>
      </div>

      {/* General section */}
      <Section
        title="General"
        tasks={generalTasks}
        clientId={clientId}
        users={users}
        currentUserId={currentUserId}
        showCompleted={showCompleted}
        onToggleComplete={handleToggleComplete}
        onTaskSaved={upsertTask}
        onDelete={handleDelete}
      />

      {/* Project sections */}
      {projectsWithMyTasks.map((project) => (
        <Section
          key={project.id}
          title={project.title}
          tasks={showAll ? (projectTaskMap[project.id] ?? []) : myProjectTasks(projectTaskMap[project.id] ?? [])}
          clientId={clientId}
          projectId={project.id}
          users={users}
          currentUserId={currentUserId}
          showCompleted={showCompleted}
          onToggleComplete={handleToggleComplete}
          onTaskSaved={upsertTask}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}

// ── Add task button (for page header) ─────────────────────────────────────────

export function AddClientTaskButton({ clientId, users }: { clientId: string; users?: UserOption[] }) {
  const { openPanel, closePanel } = useRightPanel();
  const [localUsers, setLocalUsers] = useState<UserOption[]>(users ?? []);

  useEffect(() => {
    if (!users) {
      fetch("/api/users/assignable")
        .then((r) => r.json())
        .then((data) => setLocalUsers(data))
        .catch(() => {});
    }
  }, [users]);

  return (
    <button
      type="button"
      className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
      onClick={() =>
        openPanel("Add Task", (
          <TaskForm
            clientId={clientId}
            users={localUsers}
            onSaved={() => {}}
            onClose={closePanel}
          />
        ))
      }
    >
      <Plus size={15} />
      Add task
    </button>
  );
}
