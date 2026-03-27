"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal, Check, Trash2, ListPlus, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { Task, TaskAssignee } from "@/types";

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};
const labelClass = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-muted)" };

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

// ── Assignee avatars ───────────────────────────────────────────────────────────

function AssigneeAvatars({
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
      {shown.map((a) => {
        const image = userImages?.[a.userId] ?? a.image;
        return (
        <div
          key={a.userId}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-1 ring-white dark:ring-gray-900 overflow-hidden"
          style={{ background: "var(--primary)", color: "#fff" }}
          title={a.name}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={a.name} className="w-full h-full object-cover" />
          ) : (
            a.name.charAt(0).toUpperCase()
          )}
        </div>
        );
      })}
      {rest > 0 && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ring-1"
          style={{ background: "var(--border)", color: "var(--text-muted)" }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// ── Inline task input ──────────────────────────────────────────────────────────

function InlineTaskInput({
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const title = value.trim();
      if (!title) return;
      await onSave(title);
      setValue(""); // stays open for next entry
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

// ── Task form ──────────────────────────────────────────────────────────────────

type UserOption = { id: string; name: string; image: string | null };

function TaskForm({
  projectId,
  clientId,
  task,
  parentTaskId,
  parentTaskTitle,
  users,
  onSaved,
  onClose,
}: {
  projectId: string;
  clientId: string;
  task?: Task;
  parentTaskId?: string;
  parentTaskTitle?: string;
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
  const [selectedAssignees, setSelectedAssignees] = useState<TaskAssignee[]>(
    task?.assignees ?? []
  );
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleAssignee(user: UserOption) {
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

    const url = isEdit
      ? `/api/clients/${clientId}/projects/${projectId}/tasks/${task!.id}`
      : `/api/clients/${clientId}/projects/${projectId}/tasks`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
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
          <label className={labelClass} style={labelStyle}>
            Parent task
          </label>
          <p
            className="text-sm px-3 py-2 rounded-lg"
            style={{ background: "var(--bg-sidebar)", color: "var(--text-primary)" }}
          >
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
        <label className={labelClass} style={labelStyle}>
          Description
        </label>
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
        <label className={labelClass} style={labelStyle}>
          Due date
        </label>
        <input
          type="date"
          value={form.completionDate}
          onChange={(e) => set("completionDate", e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Assignees
        </label>
        {selectedAssignees.length > 0 && (
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
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-sidebar)",
              color: "var(--text-muted)",
            }}
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
                  const isSelected = selectedAssignees.some((a) => a.userId === u.id);
                  const firstname = u.name.split(" ")[0];
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold overflow-hidden flex-shrink-0"
                          style={{ background: "var(--primary)", color: "#fff" }}
                        >
                          {u.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            firstname.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span>{firstname}</span>
                      </div>
                      {isSelected && <Check size={13} style={{ color: "var(--primary)" }} />}
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
          {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

// ── Subtask row ────────────────────────────────────────────────────────────────

function SubtaskRow({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  userImages,
  readOnly,
}: {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string, hasSubtasks: boolean) => void;
  userImages?: Record<string, string>;
  readOnly?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDone = !!task.completedAt;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && !!task.completionDate && task.completionDate < today;

  return (
    <div
      className="flex items-center gap-2 py-2 group cursor-pointer rounded-lg -mx-2 px-2"
      onClick={() => onEdit(task)}
    >
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
        className={`flex-1 text-sm truncate transition-colors ${isDone ? "" : "text-[var(--text-primary)] group-hover:text-[var(--primary)]"}`}
        style={{
          color: isDone ? "var(--text-muted)" : undefined,
          textDecoration: "none",
        }}
      >
        {task.title}
      </span>

      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <AssigneeAvatars assignees={task.assignees} userImages={userImages} />
        {task.completionDate && (
          <span className="text-xs" style={{ color: isOverdue ? "var(--destructive, #ef4444)" : "var(--text-muted)" }}>
            {task.completionDate}
          </span>
        )}

        {!readOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
              style={{ color: "var(--text-muted)" }}
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

// ── Task row ───────────────────────────────────────────────────────────────────

function TaskRow({
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
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasSubtasks = subtasks.length > 0;
  const isDone = !!task.completedAt;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && !!task.completionDate && task.completionDate < today;
  const hasOverdueSubtask = subtasks.some(
    (s) => !s.completedAt && !!s.completionDate && s.completionDate < today
  );

  const openSubtasks = subtasks.filter((s) => !s.completedAt);
  const completedSubtasks = subtasks.filter((s) => !!s.completedAt);

  const showSubtasksArea = (hasSubtasks && isExpanded) || showInlineSubtask;

  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      {/* Main task row */}
      <div
        className="flex items-center gap-2 py-2.5 group cursor-pointer rounded-lg -mx-2 px-2"
        onClick={() => onEdit(task)}
      >
        {/* Chevron / expand slot */}
        <div
          className="flex-shrink-0 w-4 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {hasSubtasks && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center justify-center transition-colors text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
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
              className={`text-sm font-medium truncate transition-colors ${isDone ? "" : "text-[var(--text-primary)] group-hover:text-[var(--primary)]"}`}
              style={{
                color: isDone ? "var(--text-muted)" : undefined,
                textDecoration: "none",
              }}
            >
              {task.title}
            </span>

            <div
              className="flex items-center gap-2 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <AssigneeAvatars assignees={task.assignees} userImages={userImages} />
              {hasOverdueSubtask && (
                <AlertTriangle
                  size={13}
                  style={{ color: "var(--destructive, #ef4444)" }}
                  aria-label="Subtask overdue"
                />
              )}
              {task.completionDate && (
                <span className="text-xs" style={{ color: isOverdue ? "var(--destructive, #ef4444)" : "var(--text-muted)" }}>
                  {task.completionDate}
                </span>
              )}

              {/* Kebab menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  <MoreHorizontal size={15} />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 top-6 z-20 rounded-xl border shadow-lg overflow-hidden w-40"
                      style={{
                        background: "var(--bg-sidebar)",
                        borderColor: "var(--border)",
                      }}
                    >
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
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {task.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Subtasks area */}
      {showSubtasksArea && (
        <div className="pl-14 pb-1">
          {/* Open subtasks first */}
          {isExpanded && openSubtasks.map((sub) => (
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

          {/* + New subtask button / inline input (open tasks only) */}
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

          {/* Completed subtasks below the add button */}
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

  const openTopLevel = topLevel.filter((t) => !isFullyCompleted(t));
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
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              completedAt: completed ? new Date().toISOString() : undefined,
              completedById: completed ? undefined : undefined,
              completedByName: completed ? undefined : undefined,
            }
          : t
      )
    );

    const res = await fetch(
      `/api/clients/${clientId}/projects/${projectId}/tasks/${task.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      }
    );

    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      router.refresh();
    } else {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
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
