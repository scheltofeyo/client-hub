"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, ChevronDown, ChevronRight, MoreHorizontal,
  Check, Trash2, ListPlus, AlertTriangle, BookOpen, GripVertical,
} from "lucide-react";
import type { Task, TaskAssignee } from "@/types";
import UserAvatar from "@/components/ui/UserAvatar";

// ── Shared styles ──────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
export const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
export const labelClass = "block text-xs font-medium mb-1";
export const labelStyle = { color: "var(--text-muted)" };

// ── Types ──────────────────────────────────────────────────────────────────────

export type UserOption = { id: string; name: string; image: string | null };

// ── Helpers ────────────────────────────────────────────────────────────────────

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── AssigneeAvatars ────────────────────────────────────────────────────────────

export function AssigneeAvatars({
  assignees,
  userImages,
}: {
  assignees: TaskAssignee[];
  userImages?: Record<string, string>;
}) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, 3);
  const rest = assignees.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((a, i) => (
        <div
          key={a.userId}
          className="rounded-full"
          style={{ boxShadow: "0 0 0 2px var(--bg-surface)", position: "relative", zIndex: i + 1 }}
        >
          <UserAvatar name={a.name} image={userImages?.[a.userId] ?? a.image} size={20} />
        </div>
      ))}
      {rest > 0 && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
          style={{
            background: "var(--border)",
            color: "var(--text-muted)",
            boxShadow: "0 0 0 2px var(--bg-surface)",
            position: "relative",
            zIndex: shown.length + 1,
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// ── InlineTaskInput ────────────────────────────────────────────────────────────

export function InlineTaskInput({
  onSave,
  onCancel,
  placeholder,
  spacerClass,
}: {
  onSave: (title: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  spacerClass?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const title = value.trim();
      if (!title) return;
      await onSave(title);
      setValue("");
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  function handleBlur() {
    if (!value.trim()) onCancel();
  }

  return (
    <div className="flex items-center gap-2 py-2 -mx-2 px-2">
      <div className={`flex-shrink-0 ${spacerClass ?? "w-[3.25rem]"}`} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder ?? "Type a task title…"}
        className="flex-1 text-sm bg-transparent outline-none border-b pb-1"
        style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
      />
    </div>
  );
}

// ── TaskForm ───────────────────────────────────────────────────────────────────
// projectId is optional — omit it for client-level tasks (no project scope).
// parentAssignees — assignees of the parent task (for subtasks). These are shown
// as locked and cannot be removed; additional assignees can still be added.

export function TaskForm({
  clientId,
  projectId,
  task,
  parentTaskId,
  parentTaskTitle,
  isSubtask,
  parentAssignees,
  users,
  onSaved,
  onClose,
}: {
  clientId: string;
  projectId?: string;
  task?: Task;
  parentTaskId?: string;
  parentTaskTitle?: string;
  isSubtask?: boolean;
  parentAssignees?: TaskAssignee[];
  users: UserOption[];
  onSaved: (task: Task) => void;
  onClose: () => void;
}) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    completionDate: task?.completionDate ?? "",
  });
  // Pre-populate with task assignees if editing, or parent assignees if creating a subtask
  const [selectedAssignees, setSelectedAssignees] = useState<TaskAssignee[]>(
    task?.assignees ?? parentAssignees ?? []
  );
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleAssignee(user: UserOption) {
    // Parent-inherited assignees cannot be removed from a subtask
    if (isSubtask && (parentAssignees ?? []).some((a) => a.userId === user.id)) return;
    setSelectedAssignees((prev) => {
      const exists = prev.find((a) => a.userId === user.id);
      if (exists) return prev.filter((a) => a.userId !== user.id);
      return [...prev, { userId: user.id, name: user.name, ...(user.image ? { image: user.image } : {}) }];
    });
  }

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError("");

    let url: string;
    const method = isEdit ? "PATCH" : "POST";

    if (isEdit) {
      url = projectId
        ? `/api/clients/${clientId}/projects/${projectId}/tasks/${task!.id}`
        : `/api/clients/${clientId}/tasks/${task!.id}`;
    } else if (projectId) {
      url = `/api/clients/${clientId}/projects/${projectId}/tasks`;
    } else {
      url = `/api/clients/${clientId}/tasks`;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        assignees: selectedAssignees,
        completionDate: form.completionDate || undefined,
        parentTaskId: parentTaskId || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const saved = await res.json();
    onSaved(saved);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {parentTaskTitle && (
        <div>
          <label className={labelClass} style={labelStyle}>Parent task</label>
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--bg-sidebar)", color: "var(--text-primary)" }}>
            {parentTaskTitle}
          </p>
        </div>
      )}

      <div>
        <label className={labelClass} style={labelStyle}>
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          autoFocus
          placeholder="Task title…"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="Optional details…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Due date</label>
        <input
          type="date"
          value={form.completionDate}
          onChange={(e) => set("completionDate", e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          Setting a due date will automatically create a system event.
        </p>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Assignees</label>

        {/* Locked parent-inherited assignees */}
        {isSubtask && (parentAssignees ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(parentAssignees ?? []).map((a) => (
              <span
                key={a.userId}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}
                title="Inherited from parent task — remove from parent to unassign"
              >
                {a.name.split(" ")[0]}
              </span>
            ))}
          </div>
        )}

        {/* Subtask: removable non-parent-inherited assignees */}
        {isSubtask && selectedAssignees.filter((a) => !(parentAssignees ?? []).some((p) => p.userId === a.userId)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedAssignees
              .filter((a) => !(parentAssignees ?? []).some((p) => p.userId === a.userId))
              .map((a) => (
                <button
                  key={a.userId}
                  type="button"
                  onClick={() => toggleAssignee({ id: a.userId, name: a.name, image: a.image ?? null })}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                >
                  {a.name.split(" ")[0]}
                  <span className="opacity-50">×</span>
                </button>
              ))}
          </div>
        )}

        {/* Non-subtask: all removable assignees */}
        {!isSubtask && selectedAssignees.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedAssignees.map((a) => (
              <button
                key={a.userId}
                type="button"
                onClick={() => toggleAssignee({ id: a.userId, name: a.name, image: a.image ?? null })}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                {a.name.split(" ")[0]}
                <span className="opacity-50">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setAssigneePickerOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors"
            style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)", color: "var(--text-muted)" }}
          >
            <Plus size={13} />
            Add assignee
          </button>
          {assigneePickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAssigneePickerOpen(false)} />
              <div
                className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border shadow-lg overflow-y-auto max-h-52"
                style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
              >
                {sortedUsers.map((u) => {
                  const isLockedByParent = isSubtask && (parentAssignees ?? []).some((a) => a.userId === u.id);
                  const isSelected = selectedAssignees.some((a) => a.userId === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => !isLockedByParent && toggleAssignee(u)}
                      disabled={isLockedByParent}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar name={u.name} image={u.image} size={24} />
                        <span>{u.name.split(" ")[0]}</span>
                      </div>
                      {isSelected && <Check size={13} style={{ color: isLockedByParent ? "var(--text-muted)" : "var(--primary)" }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !form.title.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

// ── DragGhost ──────────────────────────────────────────────────────────────────
// Hidden element used as a custom drag image via dataTransfer.setDragImage().
// Positioned off-screen so it doesn't affect layout.

function DragGhost({
  ghostRef,
  title,
  subtaskCount,
  assignees,
  userImages,
}: {
  ghostRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  subtaskCount?: number;
  assignees: TaskAssignee[];
  userImages?: Record<string, string>;
}) {
  return (
    <div
      ref={ghostRef}
      aria-hidden="true"
      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium"
      style={{
        position: "fixed",
        top: "-9999px",
        left: "0",
        pointerEvents: "none",
        background: "var(--bg-sidebar)",
        borderColor: "var(--primary)",
        color: "var(--text-primary)",
        maxWidth: "260px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>{title}</span>
      {subtaskCount !== undefined && subtaskCount > 0 && (
        <span
          className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium"
          style={{ background: "var(--border)", color: "var(--text-muted)" }}
        >
          {subtaskCount}
        </span>
      )}
      {assignees.length > 0 && (
        <div className="flex-shrink-0">
          <AssigneeAvatars assignees={assignees.slice(0, 1)} userImages={userImages} />
        </div>
      )}
    </div>
  );
}

// ── SubtaskRow ─────────────────────────────────────────────────────────────────

export function SubtaskRow({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  userImages,
  readOnly,
  isDraggable,
  isDragOver,
  isDragOverBottom,
  isDragInvalid,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string, hasSubtasks: boolean) => void;
  userImages?: Record<string, string>;
  readOnly?: boolean;
  isDraggable?: boolean;
  isDragOver?: boolean;
  /** When true, the drop indicator renders at the bottom (item will be placed after this one) */
  isDragOverBottom?: boolean;
  /** When true, hovering here is an invalid drop target — shows red indicator */
  isDragInvalid?: boolean;
  onDragStart?: (taskId: string) => void;
  onDragOver?: (taskId: string) => void;
  onDrop?: (taskId: string) => void;
  onDragEnd?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragFromHandle = useRef(false);
  const isDone = !!task.completedAt;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && !!task.completionDate && task.completionDate < today;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!dragFromHandle.current) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    if (ghostRef.current) e.dataTransfer.setDragImage(ghostRef.current, 14, 14);
    onDragStart?.(task.id);
  }, [task.id, onDragStart]);

  const dragBorderStyle = isDragOver
    ? isDragInvalid
      ? { borderTop: "2px solid var(--destructive, #ef4444)" }
      : isDragOverBottom
        ? { borderBottom: "2px solid var(--primary)" }
        : { borderTop: "2px solid var(--primary)" }
    : undefined;

  return (
    <div
      className="flex items-center gap-2 py-2 group cursor-pointer rounded-lg -mx-2 px-2"
      style={dragBorderStyle}
      draggable={isDraggable}
      onMouseDown={() => { dragFromHandle.current = false; }}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragOver={isDraggable && onDragOver ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDragInvalid) e.dataTransfer.dropEffect = "none";
        onDragOver(task.id);
      } : undefined}
      onDrop={isDraggable && onDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDrop(task.id); } : undefined}
      onDragEnd={isDraggable && onDragEnd ? (e) => { e.stopPropagation(); dragFromHandle.current = false; onDragEnd(); } : undefined}
      onClick={() => onEdit(task)}
    >
      {/* Ghost for custom drag image */}
      <DragGhost ghostRef={ghostRef} title={task.title} assignees={task.assignees} userImages={userImages} />

      {/* Drag handle */}
      {isDraggable && (
        <div
          className="flex-shrink-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing"
          style={{ color: "var(--text-muted)" }}
          onMouseDown={(e) => { e.stopPropagation(); dragFromHandle.current = true; }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </div>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
        style={{
          borderColor: isDone ? "var(--primary-light)" : "var(--border)",
          background: isDone ? "var(--primary-light)" : "transparent",
        }}
      >
        {isDone && <Check size={14} color="var(--primary)" strokeWidth={3} />}
      </button>

      <span
        className={`flex-1 text-sm transition-colors ${isDone ? "" : "text-[var(--text-primary)] group-hover:text-[var(--primary)]"}`}
        style={{ color: isDone ? "var(--text-muted)" : undefined }}
      >
        {task.title}
      </span>

      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {isDone ? (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.completedAt && (
              <span className="text-xs leading-none" style={{ color: "var(--text-muted)" }}>
                Completed on {fmtDate(task.completedAt)}
              </span>
            )}
            {task.completedById && (
              <UserAvatar name={task.completedByName ?? "?"} image={userImages?.[task.completedById]} size={20} />
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {task.createdAt && (
                <span className="text-xs leading-none" style={{ color: "var(--text-muted)" }}>
                  Created on {fmtDate(task.createdAt)}
                </span>
              )}
              <UserAvatar name={task.createdByName} image={userImages?.[task.createdById]} size={20} />
            </div>
            <AssigneeAvatars assignees={task.assignees} userImages={userImages} />
            {task.completionDate && (
              <span className="text-xs" style={{ color: isOverdue ? "var(--destructive, #ef4444)" : "var(--text-muted)" }}>
                {task.completionDate}
              </span>
            )}
          </>
        )}

        {!readOnly && !isDone && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-md btn-icon opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-6 z-20 rounded-xl border shadow-lg overflow-hidden w-36"
                  style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onDelete(task.id, false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity text-red-500"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── TaskRow ────────────────────────────────────────────────────────────────────
// onViewInLogbook — when provided, replaces the standard kebab menu with a
// "View in logbook" option (used for log-derived follow-up tasks).

export function TaskRow({
  task,
  subtasks,
  isExpanded,
  onToggleExpand,
  onToggleComplete,
  onEdit,
  onAddSubtask,
  onDelete,
  showInlineSubtask,
  onInlineSubtaskSave,
  onInlineSubtaskCancel,
  userImages,
  readOnly,
  onViewInLogbook,
  isDraggable,
  draggingId,
  draggingHasChildren,
  dragOverId,
  isDragOverBottom,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  task: Task;
  subtasks: Task[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (parentTaskId: string) => void;
  onDelete: (taskId: string, hasSubtasks: boolean) => void;
  showInlineSubtask: boolean;
  onInlineSubtaskSave: (title: string) => Promise<void>;
  onInlineSubtaskCancel: () => void;
  userImages?: Record<string, string>;
  readOnly?: boolean;
  onViewInLogbook?: () => void;
  isDraggable?: boolean;
  /** ID of the task currently being dragged (for computing subtask drop-indicator direction) */
  draggingId?: string | null;
  /** When true, the dragging task has children — dropping into a subtask area is invalid */
  draggingHasChildren?: boolean;
  /** ID of whichever task/subtask the pointer is currently over during a drag */
  dragOverId?: string | null;
  /** When true, the drop indicator on this row renders at the bottom */
  isDragOverBottom?: boolean;
  onDragStart?: (taskId: string) => void;
  onDragOver?: (taskId: string) => void;
  onDrop?: (taskId: string) => void;
  onDragEnd?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragFromHandle = useRef(false);
  const hasSubtasks = subtasks.length > 0;
  const isDone = !!task.completedAt;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && !!task.completionDate && task.completionDate < today;
  const hasOverdueSubtask = subtasks.some(
    (s) => !s.completedAt && !!s.completionDate && s.completionDate < today
  );
  const openSubtasks = subtasks
    .filter((s) => !s.completedAt)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const completedSubtasks = subtasks.filter((s) => !!s.completedAt);
  const showSubtasksArea = (hasSubtasks && isExpanded) || showInlineSubtask;

  // Whether this row itself is the drag-over target
  const isRowDragOver = dragOverId === task.id;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!dragFromHandle.current) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    if (ghostRef.current) e.dataTransfer.setDragImage(ghostRef.current, 14, 14);
    onDragStart?.(task.id);
  }, [task.id, onDragStart]);

  const rowBorderStyle = isRowDragOver
    ? isDragOverBottom
      ? { borderBottom: "2px solid var(--primary)" }
      : { borderTop: "2px solid var(--primary)" }
    : undefined;

  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--border)" }}
      draggable={isDraggable}
      onMouseDown={() => { dragFromHandle.current = false; }}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onDragEnd={isDraggable && onDragEnd ? () => { dragFromHandle.current = false; onDragEnd(); } : undefined}
    >
      {/* Ghost for custom drag image */}
      <DragGhost
        ghostRef={ghostRef}
        title={task.title}
        subtaskCount={openSubtasks.length}
        assignees={task.assignees}
        userImages={userImages}
      />

      {/* Main task row — also a drop target (top-level reorder + subtask→parent) */}
      <div
        className="flex items-center gap-2 py-2.5 group cursor-pointer rounded-lg -mx-2 px-2"
        style={rowBorderStyle}
        onClick={() => onEdit(task)}
        onDragOver={onDragOver ? (e) => { e.preventDefault(); e.stopPropagation(); onDragOver(task.id); } : undefined}
        onDrop={onDrop ? (e) => { e.preventDefault(); e.stopPropagation(); onDrop(task.id); } : undefined}
      >
        {/* Drag handle */}
        {isDraggable && (
          <div
            className="flex-shrink-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing"
            style={{ color: "var(--text-muted)" }}
            onMouseDown={(e) => { e.stopPropagation(); dragFromHandle.current = true; }}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={13} />
          </div>
        )}
        {/* Chevron / expand slot */}
        <div
          className="self-stretch flex-shrink-0 w-5 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); if (hasSubtasks) onToggleExpand(); }}
          style={{ cursor: hasSubtasks ? "pointer" : "default" }}
        >
          {hasSubtasks ? (
            <span className="transition-colors text-[var(--text-muted)] hover:text-[var(--primary)]">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          ) : !readOnly && !isDone && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddSubtask(task.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity rounded"
              style={{ color: "var(--primary)" }}
              title="Add subtask"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
          className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: isDone ? "var(--primary-light)" : "var(--border)",
            background: isDone ? "var(--primary-light)" : "transparent",
          }}
          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone && <Check size={14} color="var(--primary)" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm font-medium transition-colors ${isDone ? "" : "text-[var(--text-primary)] group-hover:text-[var(--primary)]"}`}
              style={{ color: isDone ? "var(--text-muted)" : undefined }}
            >
              {task.logId && (
                <span className="mr-1 font-normal" style={{ color: "var(--text-muted)" }}>Follow up:</span>
              )}
              {task.title}
              {task.logId && (
                <BookOpen size={11} className="inline ml-1.5 mb-0.5" style={{ color: "var(--text-muted)" }} />
              )}
            </span>

            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {isDone ? (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {task.completedAt && (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Completed on {fmtDate(task.completedAt)}
                    </span>
                  )}
                  {task.completedById && (
                    <UserAvatar name={task.completedByName ?? "?"} image={userImages?.[task.completedById]} size={20} />
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {task.createdAt && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Created on {fmtDate(task.createdAt)}
                      </span>
                    )}
                    <UserAvatar name={task.createdByName} image={userImages?.[task.createdById]} size={20} />
                  </div>
                  <AssigneeAvatars assignees={task.assignees} userImages={userImages} />
                  {hasOverdueSubtask && (
                    <AlertTriangle size={13} style={{ color: "var(--destructive, #ef4444)" }} aria-label="Subtask overdue" />
                  )}
                  {task.completionDate && (
                    <span className="text-xs" style={{ color: isOverdue ? "var(--destructive, #ef4444)" : "var(--text-muted)" }}>
                      {task.completionDate}
                    </span>
                  )}
                </>
              )}

              {/* Kebab menu */}
              {!isDone && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="p-1.5 rounded-md btn-icon opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div
                        className="absolute right-0 top-6 z-20 rounded-xl border shadow-lg overflow-hidden w-40"
                        style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
                      >
                        {onViewInLogbook ? (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); onViewInLogbook(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <BookOpen size={13} /> View in logbook
                          </button>
                        ) : (
                          <>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => { setMenuOpen(false); onAddSubtask(task.id); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                                style={{ color: "var(--text-primary)" }}
                              >
                                <ListPlus size={13} /> Add subtask
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setMenuOpen(false); onDelete(task.id, hasSubtasks); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity text-red-500"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {task.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
              {task.description}
            </p>
          )}
          {!isExpanded && openSubtasks.length > 0 && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              {openSubtasks.length} open subtask{openSubtasks.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Subtasks area */}
      {showSubtasksArea && (
        <div
          className="pl-14 pb-1 rounded-b-lg transition-colors"
          style={
            draggingHasChildren && dragOverId && openSubtasks.some((s) => s.id === dragOverId)
              ? { background: "color-mix(in srgb, var(--destructive, #ef4444) 6%, transparent)" }
              : undefined
          }
        >
          {isExpanded && openSubtasks.map((sub, subIdx) => {
            const fromSubIdx = draggingId ? openSubtasks.findIndex((s) => s.id === draggingId) : -1;
            const isSubDragOverBottom = fromSubIdx !== -1 && fromSubIdx < subIdx;
            return (
              <SubtaskRow
                key={sub.id}
                task={sub}
                onToggleComplete={onToggleComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                userImages={userImages}
                readOnly={readOnly}
                isDraggable={!readOnly && !sub.completedAt}
                isDragOver={dragOverId === sub.id}
                isDragOverBottom={dragOverId === sub.id ? isSubDragOverBottom : undefined}
                isDragInvalid={!!draggingHasChildren}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            );
          })}

          {!readOnly && (
            showInlineSubtask ? (
              <InlineTaskInput
                placeholder="Type subtask title…"
                onSave={onInlineSubtaskSave}
                onCancel={onInlineSubtaskCancel}
                spacerClass="w-6"
              />
            ) : hasSubtasks && isExpanded ? (
              <button
                type="button"
                onClick={() => onAddSubtask(task.id)}
                className="flex items-center gap-1.5 text-sm py-1.5 px-2 rounded-lg btn-tertiary"
              >
                <Plus size={12} />
                New subtask
              </button>
            ) : null
          )}

          {isExpanded && completedSubtasks.map((sub) => (
            <SubtaskRow
              key={sub.id}
              task={sub}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              userImages={userImages}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
