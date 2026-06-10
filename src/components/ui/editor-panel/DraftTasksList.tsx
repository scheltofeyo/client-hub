"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import { TaskForm, TaskRow, InlineTaskInput } from "@/components/ui/task-row";
import type { Task } from "@/types";
import { draftTaskToTask, type DraftTask } from "./draft-types";

/**
 * A draft project's tasks, rendered with the shared TaskRow primitive so the
 * behaviour matches the regular project Tasks tab (drag-to-reorder, subtasks,
 * inline add). Lives inside the project editor panel, so its task form opens in
 * a STACKED panel (`openSecondaryPanel`) rather than replacing the editor.
 */
export default function DraftTasksList({
  clientId,
  projectId,
  tasks: serverTasks,
  users,
  readonly,
  canCreateTask,
  canEditAnyTask,
  canDeleteAnyTask,
  onTasksChanged,
  onCountChange,
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
  onCountChange?: (openTopLevelCount: number) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>(() => serverTasks.map(draftTaskToTask));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleInFlightRef = useRef<Set<string>>(new Set());
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineSubtaskFor, setInlineSubtaskFor] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const { openSecondaryPanel, closeSecondaryPanel } = useRightPanel();

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
  const subtasksOf = useCallback((id: string) => tasks.filter((t) => t.parentTaskId === id), [tasks]);

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

  useEffect(() => {
    onCountChange?.(openTopLevel.length);
  }, [openTopLevel.length, onCountChange]);

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
    openSecondaryPanel(
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
        onClose={closeSecondaryPanel}
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

    await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
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
      prev.map((t) => (t.id === subtaskId ? { ...t, parentTaskId: newParentId, assignees: newParent.assignees } : t))
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
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
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
