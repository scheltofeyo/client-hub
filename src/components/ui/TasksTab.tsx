"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Task } from "@/types";
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

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-wide mb-3"
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
}: {
  projectId: string;
  clientId: string;
  initialTasks: Task[];
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
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
    const parentTitle = task.parentTaskId
      ? tasks.find((t) => t.id === task.parentTaskId)?.title
      : undefined;
    openPanel(
      "Edit Task",
      <TaskForm
        projectId={projectId}
        clientId={clientId}
        task={task}
        parentTaskTitle={parentTitle}
        isSubtask={!!task.parentTaskId}
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

    if (!dragging.parentTaskId && !target.parentTaskId) {
      // Top-level → top-level: reorder
      await reorderTopLevel(fromId, dropTargetId);
    } else if (dragging.parentTaskId && !target.parentTaskId) {
      // Subtask dropped on top-level task header: move to that parent (append)
      await moveSubtask(fromId, dropTargetId);
    } else if (dragging.parentTaskId && target.parentTaskId) {
      if (dragging.parentTaskId === target.parentTaskId) {
        // Same parent: reorder subtasks
        await reorderSubtasks(fromId, dropTargetId, dragging.parentTaskId);
      } else {
        // Different parent: move subtask, insert before the target subtask
        await moveSubtask(fromId, target.parentTaskId, dropTargetId);
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const allOpen = tasks.filter((t) => !t.completedAt);
  const allCompleted = tasks.filter((t) => t.completedAt);
  const myTasks = tasks.filter((t) => t.assignees.some((a) => a.userId === currentUserId));
  const myOpen = myTasks.filter((t) => !t.completedAt);
  const myCompleted = myTasks.filter((t) => t.completedAt);
  const overdue = tasks.filter((t) => !t.completedAt && t.completionDate && t.completionDate < today);

  return (
    <div className="max-w-3xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="All open tasks"
          count={allOpen.length}
          completed={allCompleted.length}
          total={tasks.length}
        />
        <StatCard
          label="Open for you"
          count={myOpen.length}
          completed={myCompleted.length}
          total={myTasks.length}
        />
        <StatCard
          label="Overdue"
          count={overdue.length}
          accent={overdue.length > 0 ? "var(--destructive, #ef4444)" : undefined}
        />
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
        {openTopLevel.map((task) => (
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
            isDraggable={true}
            dragOverId={dragOverId}
            onDragStart={(id) => setDraggingId(id)}
            onDragOver={(id) => setDragOverId(id)}
            onDrop={handleDrop}
            onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
          />
        ))}
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
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
