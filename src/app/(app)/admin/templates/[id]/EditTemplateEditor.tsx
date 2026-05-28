"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ProjectRole,
  ProjectTemplate,
  RoleAllocationLine,
  Service,
  TemplateSession,
  TemplateTask,
} from "@/types";
import { useRightPanel } from "@/components/layout/RightPanel";
import PageHeader from "@/components/layout/PageHeader";
import RichTextEditor from "@/components/ui/RichTextEditor";
import ServicePills from "@/components/ui/ServicePills";

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

// ── Inline task input ─────────────────────────────────────────────────────────

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
      <div className={`flex-shrink-0 ${spacerClass ?? "w-[4.75rem]"}`} />
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

// ── Template task form (shown in RightPanel) ──────────────────────────────────

function TemplateTaskForm({
  templateId,
  task,
  parentTask,
  onSaved,
  onClose,
}: {
  templateId: string;
  task?: TemplateTask;
  parentTask?: TemplateTask;
  onSaved: (saved: TemplateTask) => void;
  onClose: () => void;
}) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignToClientLead: task?.assignToClientLead ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError("");

    const url = isEdit
      ? `/api/project-templates/${templateId}/tasks/${task!.id}`
      : `/api/project-templates/${templateId}/tasks`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        assignToClientLead: form.assignToClientLead,
        parentTaskId: parentTask?.id,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Something went wrong");
      return;
    }

    const saved = await res.json();
    onSaved(saved);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {parentTask && (
        <div>
          <label className="typo-label">
            Parent task
          </label>
          <p
            className="text-sm px-3 py-2 rounded-lg"
            style={{ background: "var(--bg-sidebar)", color: "var(--text-primary)" }}
          >
            {parentTask.title}
          </p>
        </div>
      )}

      <div>
        <label className="typo-label">
          Title <span className="text-[var(--danger)]">*</span>
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
        <label className="typo-label">
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

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.assignToClientLead}
          onChange={(e) => set("assignToClientLead", e.target.checked)}
          className="mt-0.5 accent-[var(--primary)]"
        />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Assign to client lead
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            This task will be assigned to the client&apos;s leads when a project is created from this template.
          </p>
        </div>
      </label>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

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
          {loading ? "Saving…" : isEdit ? "Save changes" : "Add task"}
        </button>
      </div>
    </form>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isSubtask,
  hasSubtasks,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: TemplateTask;
  isSubtask?: boolean;
  hasSubtasks?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onEdit: (task: TemplateTask) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask?: (parentTask: TemplateTask) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`flex items-start gap-2 py-2 group cursor-pointer rounded-lg -mx-2 px-2 ${isSubtask ? "ml-8" : ""}`}
      onClick={() => onEdit(task)}
    >
      {/* Drag handle */}
      <div
        className="flex-shrink-0 w-4 mt-0.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-muted)" }}
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </div>

      {/* Chevron / add-subtask slot (top-level only) */}
      {!isSubtask && (
        <div
          className="flex-shrink-0 w-4 mt-0.5 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {hasSubtasks ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center justify-center transition-colors text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : onAddSubtask ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddSubtask(task); }}
              className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--primary)" }}
              title="Add subtask"
            >
              <Plus size={13} />
            </button>
          ) : null}
        </div>
      )}

      {/* Circle — dimmed primary fill, checkbox-sized */}
      <div
        className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5"
        style={{ background: "var(--primary)", opacity: 0.25 }}
      />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm transition-colors group-hover:text-[var(--primary)]"
          style={{ color: "var(--text-primary)" }}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {task.description.length > 80 ? task.description.slice(0, 80) + "…" : task.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {task.assignToClientLead && (
          <span
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            <UserCheck size={10} />
            Client lead
          </span>
        )}

        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded-md btn-icon"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-20 rounded-xl border shadow-lg min-w-[140px] overflow-hidden"
                style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
              >
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEdit(task); }}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                  style={{ color: "var(--text-primary)" }}
                >
                  Edit
                </button>
                {!isSubtask && onAddSubtask && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onAddSubtask(task); }}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Add subtask
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(task.id); }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--danger)] hover:opacity-80 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task list section ─────────────────────────────────────────────────────────

function TaskListSection({
  templateId,
  tasks,
  onTasksChange,
}: {
  templateId: string;
  tasks: TemplateTask[];
  onTasksChange: (tasks: TemplateTask[]) => void;
}) {
  const { openPanel, closePanel } = useRightPanel();
  const [addingSubtaskForId, setAddingSubtaskForId] = useState<string | null>(null);
  const [showingAddInput, setShowingAddInput] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function reorderIds(ids: string[]) {
    await fetch(`/api/project-templates/${templateId}/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  }

  async function handleTopLevelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const top = tasks.filter((t) => !t.parentTaskId);
    const oldIndex = top.findIndex((t) => t.id === active.id);
    const newIndex = top.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newTop = arrayMove(top, oldIndex, newIndex);
    const subs = tasks.filter((t) => t.parentTaskId);
    onTasksChange([...newTop, ...subs]);
    await reorderIds(newTop.map((t) => t.id));
  }

  async function handleSubtaskDragEnd(event: DragEndEvent, parentId: string) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const parentSubs = tasks.filter((t) => t.parentTaskId === parentId);
    const oldIndex = parentSubs.findIndex((t) => t.id === active.id);
    const newIndex = parentSubs.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSubs = arrayMove(parentSubs, oldIndex, newIndex);
    const others = tasks.filter((t) => t.parentTaskId !== parentId);
    onTasksChange([...others, ...newSubs]);
    await reorderIds(newSubs.map((t) => t.id));
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEditPanel(task: TemplateTask, parentTask?: TemplateTask) {
    openPanel(
      "Edit task",
      <TemplateTaskForm
        templateId={templateId}
        task={task}
        parentTask={parentTask}
        onSaved={(saved) => {
          onTasksChange(tasks.map((t) => (t.id === saved.id ? saved : t)));
        }}
        onClose={closePanel}
      />
    );
  }

  async function handleInlineAdd(title: string, parentTaskId?: string) {
    const res = await fetch(`/api/project-templates/${templateId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parentTaskId }),
    });
    if (!res.ok) return;
    const created: TemplateTask = await res.json();
    onTasksChange([...tasks, created]);
    if (parentTaskId) {
      setExpandedIds((prev) => new Set([...prev, parentTaskId]));
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(
      `/api/project-templates/${templateId}/tasks/${taskId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    onTasksChange(tasks.filter((t) => t.id !== taskId && t.parentTaskId !== taskId));
  }

  const topLevel = tasks.filter((t) => !t.parentTaskId);
  const subtasksOf = (parentId: string) => tasks.filter((t) => t.parentTaskId === parentId);

  return (
    <div>
      <div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleTopLevelDragEnd}
        >
          <SortableContext
            items={topLevel.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {topLevel.map((task) => {
              const subs = subtasksOf(task.id);
              const isExpanded = expandedIds.has(task.id);
              const showInlineSub = addingSubtaskForId === task.id;

              return (
                <div key={task.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <TaskRow
                    task={task}
                    hasSubtasks={subs.length > 0}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpand(task.id)}
                    onEdit={(t) => openEditPanel(t)}
                    onDelete={handleDelete}
                    onAddSubtask={(parent) => {
                      setAddingSubtaskForId(parent.id);
                      setExpandedIds((prev) => new Set([...prev, parent.id]));
                      setShowingAddInput(false);
                    }}
                  />
                  {(isExpanded || showInlineSub) && (
                    <div className="pb-2">
                      {isExpanded && subs.length > 0 && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) => handleSubtaskDragEnd(e, task.id)}
                        >
                          <SortableContext
                            items={subs.map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {subs.map((sub) => (
                              <TaskRow
                                key={sub.id}
                                task={sub}
                                isSubtask
                                onEdit={(t) => openEditPanel(t, task)}
                                onDelete={handleDelete}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      )}
                      {isExpanded && subs.length > 0 && !showInlineSub && (
                        <button
                          type="button"
                          onClick={() => setAddingSubtaskForId(task.id)}
                          className="flex items-center gap-1.5 ml-8 text-sm py-1 px-2 rounded-lg btn-tertiary"
                        >
                          <Plus size={12} />
                          Add subtask
                        </button>
                      )}
                      {showInlineSub && (
                        <InlineTaskInput
                          spacerClass="w-[5.25rem]"
                          placeholder="Subtask title…"
                          onSave={async (title) => {
                            await handleInlineAdd(title, task.id);
                          }}
                          onCancel={() => setAddingSubtaskForId(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {tasks.length === 0 && !showingAddInput && (
        <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
          No tasks yet.
        </p>
      )}

      {showingAddInput ? (
        <InlineTaskInput
          onSave={async (title) => {
            await handleInlineAdd(title);
          }}
          onCancel={() => setShowingAddInput(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setShowingAddInput(true); setAddingSubtaskForId(null); }}
          className="flex items-center gap-1.5 mt-3 text-sm btn-link"
          style={{ color: "var(--text-muted)" }}
        >
          <Plus size={13} />
          Add task
        </button>
      )}
    </div>
  );
}

// ── Template session form (RightPanel) ────────────────────────────────────────

function TemplateSessionForm({
  templateId,
  templateSession,
  onSaved,
  onClose,
}: {
  templateId: string;
  templateSession?: TemplateSession;
  onSaved: (saved: TemplateSession) => void;
  onClose: () => void;
}) {
  const isEdit = !!templateSession;
  const [title, setTitle] = useState(templateSession?.title ?? "");
  const [info, setInfo] = useState(templateSession?.info ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");

    const url = isEdit
      ? `/api/project-templates/${templateId}/sessions/${templateSession!.id}`
      : `/api/project-templates/${templateId}/sessions`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        info: info.trim() || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      return;
    }
    const saved = await res.json();
    onSaved(saved);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="typo-label">
          Title <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          placeholder="e.g. Kickoff workshop"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label className="typo-label">Info</label>
        <textarea
          value={info}
          onChange={(e) => setInfo(e.target.value)}
          rows={4}
          placeholder="Notes / preparation instructions for participants…"
          className={inputClass + " resize-none"}
          style={inputStyle}
        />
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
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
          disabled={loading || !title.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
        >
          {loading ? "Saving…" : isEdit ? "Save changes" : "Add session"}
        </button>
      </div>
    </form>
  );
}

// ── Sessions list section ─────────────────────────────────────────────────────

function SessionsListSection({
  templateId,
  sessions,
  onSessionsChange,
}: {
  templateId: string;
  sessions: TemplateSession[];
  onSessionsChange: (sessions: TemplateSession[]) => void;
}) {
  const { openPanel, closePanel } = useRightPanel();

  function openCreate() {
    openPanel(
      "Add session",
      <TemplateSessionForm
        templateId={templateId}
        onSaved={(saved) => onSessionsChange([...sessions, saved])}
        onClose={closePanel}
      />
    );
  }

  function openEdit(ts: TemplateSession) {
    openPanel(
      "Edit session",
      <TemplateSessionForm
        templateId={templateId}
        templateSession={ts}
        onSaved={(saved) =>
          onSessionsChange(sessions.map((s) => (s.id === saved.id ? saved : s)))
        }
        onClose={closePanel}
      />
    );
  }

  async function handleDelete(ts: TemplateSession) {
    if (!confirm(`Delete "${ts.title}"?`)) return;
    const res = await fetch(
      `/api/project-templates/${templateId}/sessions/${ts.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    onSessionsChange(sessions.filter((s) => s.id !== ts.id));
  }

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
        Sessions are workshops or meetings with the client. When a project is
        created from this template, each session is added as a draft and a
        &ldquo;Plan {"{title}"}&rdquo; task is generated.
      </p>

      {sessions.length === 0 && (
        <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
          No sessions yet.
        </p>
      )}

      {sessions.map((ts) => (
        <div
          key={ts.id}
          className="flex items-start gap-2 py-2 border-b group"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {ts.title}
            </p>
            {ts.info && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {ts.info.length > 120 ? ts.info.slice(0, 120) + "…" : ts.info}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => openEdit(ts)}
              className="btn-icon p-1.5 rounded-md"
              aria-label="Edit session"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(ts)}
              className="btn-icon p-1.5 rounded-md"
              aria-label="Delete session"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={openCreate}
        className="flex items-center gap-1.5 mt-3 text-sm btn-link"
        style={{ color: "var(--text-muted)" }}
      >
        <Plus size={13} />
        Add session
      </button>
    </div>
  );
}

// ── Tertiary tab bar ──────────────────────────────────────────────────────────

type Tab = "settings" | "budget" | "tasks" | "sessions";

function TertiaryNav({ tab, onTabChange }: { tab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {(["settings", "budget", "tasks", "sessions"] as Tab[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onTabChange(t)}
          className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors capitalize"
          style={{
            borderColor: tab === t ? "var(--primary)" : "transparent",
            color: tab === t ? "var(--primary)" : "var(--text-muted)",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Template budget editor ────────────────────────────────────────────────────

type TemplateAllocationLine = Omit<RoleAllocationLine, "assignedUser">;

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function lineTotal(l: TemplateAllocationLine) {
  return (l.days || 0) * (l.dayRate || 0) * (l.marginMultiplier || 1);
}

function TemplateBudgetEditor({
  pricingMode,
  allocation,
  projectRoles,
  defaultSoldPrice,
  onPricingModeChange,
  onAllocationChange,
  onDefaultSoldPriceChange,
}: {
  pricingMode: "manual" | "rolebased";
  allocation: TemplateAllocationLine[];
  projectRoles: ProjectRole[];
  defaultSoldPrice: string;
  onPricingModeChange: (m: "manual" | "rolebased") => void;
  onAllocationChange: (lines: TemplateAllocationLine[]) => void;
  onDefaultSoldPriceChange: (v: string) => void;
}) {
  function addLine() {
    if (projectRoles.length === 0) return;
    const role = projectRoles[0];
    onAllocationChange([
      ...allocation,
      {
        roleId: role.id,
        roleName: role.name,
        days: 0,
        dayRate: role.dayRate,
        marginMultiplier: role.marginMultiplier,
        isExternal: role.isExternal,
        externalCostRate: role.isExternal ? role.externalCostRate : undefined,
      },
    ]);
  }

  function updateLine(i: number, patch: Partial<TemplateAllocationLine>) {
    onAllocationChange(allocation.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
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
    onAllocationChange(allocation.filter((_, idx) => idx !== i));
  }

  const total = allocation.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div
          className="inline-flex rounded-md border p-0.5"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          {(["rolebased", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPricingModeChange(m)}
              className="px-2 py-1 text-xs font-medium rounded-sm transition-colors"
              style={{
                background: pricingMode === m ? "var(--bg-surface)" : "transparent",
                color: pricingMode === m ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {m === "manual" ? "Fixed" : "Role-based"}
            </button>
          ))}
        </div>
        {pricingMode === "rolebased" && (
          <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
            {formatEuro(total)}
          </span>
        )}
      </div>

      {pricingMode === "rolebased" && (
        <>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div
              className="grid items-center px-3 py-2 typo-section-header"
              style={{
                gridTemplateColumns: "1fr 90px 130px 32px",
                gap: 8,
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
              }}
            >
              <span>Role</span>
              <span>Days</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {allocation.map((line, i) => (
              <div
                key={i}
                className="grid items-center px-3 py-2 text-sm"
                style={{
                  gridTemplateColumns: "1fr 90px 130px 32px",
                  gap: 8,
                  borderBottom: i < allocation.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <select
                  value={line.roleId}
                  onChange={(e) => changeRole(i, e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  {projectRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.isExternal ? " (ext)" : ""}
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
                  onChange={(e) => updateLine(i, { days: Number(e.target.value) })}
                  className={inputClass}
                  style={inputStyle}
                />
                <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatEuro(lineTotal(line))}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="p-1.5 rounded-md btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)]"
                  title="Remove line"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {allocation.length === 0 && (
              <div className="px-3 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No role lines yet.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={addLine}
            disabled={projectRoles.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-tertiary disabled:opacity-50"
          >
            <Plus size={12} />
            Add role line
          </button>
          {projectRoles.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No project roles defined yet — set them up in admin → Labels and Types → Project Roles.
            </p>
          )}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Day rate, multiplier and pay-out are snapshotted from the role at the moment the line is added.
            Later edits in admin do not change existing templates or projects.
          </p>
        </>
      )}

      {pricingMode === "manual" && (
        <div>
          <label className="typo-label">Default sold price (€)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={defaultSoldPrice}
            onChange={(e) => onDefaultSoldPriceChange(e.target.value)}
            placeholder="e.g. 5000"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function EditTemplateEditor({
  template,
  initialTasks,
  initialSessions,
  services,
  projectRoles,
}: {
  template: ProjectTemplate;
  initialTasks: TemplateTask[];
  initialSessions: TemplateSession[];
  services: Service[];
  projectRoles: ProjectRole[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [form, setForm] = useState({
    name: template.name,
    summary: template.summary ?? "",
    defaultDescription: template.defaultDescription ?? "",
    defaultWhy: template.defaultWhy ?? "",
    defaultHow: template.defaultHow ?? "",
    defaultWhat: template.defaultWhat ?? "",
    defaultActivities: template.defaultActivities ?? "",
    defaultDeliverables: template.defaultDeliverables ?? "",
    defaultSoldPrice:
      template.defaultSoldPrice != null ? String(template.defaultSoldPrice) : "",
    defaultServiceId: template.defaultServiceId ?? "",
    defaultDeliveryDays:
      template.defaultDeliveryDays != null ? String(template.defaultDeliveryDays) : "",
  });
  const [pricingMode, setPricingMode] = useState<"manual" | "rolebased">(
    template.defaultPricingMode ?? "rolebased"
  );
  const [allocation, setAllocation] = useState<TemplateAllocationLine[]>(
    (template.defaultRoleAllocation ?? []).map((l) => ({
      roleId: l.roleId,
      roleName: l.roleName,
      days: l.days,
      dayRate: l.dayRate,
      marginMultiplier: l.marginMultiplier,
      isExternal: l.isExternal,
      externalCostRate: l.externalCostRate,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [tasks, setTasks] = useState<TemplateTask[]>(initialTasks);
  const [sessions, setSessions] = useState<TemplateSession[]>(initialSessions);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveFields(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.defaultServiceId) {
      setSaveError("Please select a service.");
      // Switch to settings tab so user sees the error
      setTab("settings");
      return;
    }
    setSaving(true);
    setSaveError("");

    const res = await fetch(`/api/project-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        summary: form.summary || undefined,
        defaultDescription: form.defaultDescription || undefined,
        defaultWhy: form.defaultWhy || undefined,
        defaultHow: form.defaultHow || undefined,
        defaultWhat: form.defaultWhat || undefined,
        defaultActivities: form.defaultActivities || undefined,
        defaultDeliverables: form.defaultDeliverables || undefined,
        defaultSoldPrice: form.defaultSoldPrice ? Number(form.defaultSoldPrice) : undefined,
        defaultServiceId: form.defaultServiceId || undefined,
        defaultDeliveryDays: form.defaultDeliveryDays ? Number(form.defaultDeliveryDays) : undefined,
        defaultPricingMode: pricingMode,
        defaultRoleAllocation: pricingMode === "rolebased" ? allocation : [],
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const d = await res.json();
      setSaveError(d.error ?? "Failed to save");
      setTab("settings");
      return;
    }

    router.push("/admin?tab=templates");
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Project Templates", href: "/admin?tab=templates" },
          { label: "..." },
        ]}
        title={template.name}
        actions={
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 btn-primary"
          >
            <Check size={13} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        }
        tertiaryNav={<TertiaryNav tab={tab} onTabChange={setTab} />}
      />

      <div className="px-7 py-6 max-w-2xl">
        {/* Settings form — always in DOM so formRef works from either tab */}
        <form
          ref={formRef}
          onSubmit={handleSaveFields}
          className={`space-y-4 ${tab !== "settings" ? "hidden" : ""}`}
        >
          {saveError && <p className="text-xs text-[var(--danger)]">{saveError}</p>}

          <div>
            <label className="typo-label">
              Template name <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Website Project"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <ServicePills
            services={services}
            selectedId={form.defaultServiceId}
            onChange={(id) => set("defaultServiceId", id)}
            label="Service"
            required
          />

          <div>
            <label className="typo-label">
              Summary
            </label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Shown under the title when picking a template"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="typo-label">
              Default project description
            </label>
            <RichTextEditor
              content={form.defaultDescription}
              onChange={(html) => set("defaultDescription", html)}
              placeholder="Pre-fills the project description field…"
            />
          </div>

          {(
            [
              { field: "defaultWhy", label: "Why", placeholder: "Why we're doing this project…" },
              { field: "defaultWhat", label: "What", placeholder: "What we'll deliver…" },
              { field: "defaultHow", label: "How", placeholder: "How we'll approach it…" },
              { field: "defaultActivities", label: "Activities", placeholder: "Key activities or sessions…" },
              { field: "defaultDeliverables", label: "Deliverables", placeholder: "Concrete deliverables for the client…" },
            ] as const
          ).map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="typo-label">{label}</label>
              <RichTextEditor
                content={form[field]}
                onChange={(html) => set(field, html)}
                placeholder={placeholder}
              />
            </div>
          ))}

          <div>
            <label className="typo-label">
              Delivery — days after creation
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.defaultDeliveryDays}
              onChange={(e) => set("defaultDeliveryDays", e.target.value)}
              placeholder="e.g. 30"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </form>

        {/* Budget tab */}
        <div className={tab !== "budget" ? "hidden" : ""}>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Defines the pricing model and snapshotted role lines that are copied
            onto each project created from this template.
          </p>
          <TemplateBudgetEditor
            pricingMode={pricingMode}
            allocation={allocation}
            projectRoles={projectRoles}
            defaultSoldPrice={form.defaultSoldPrice}
            onPricingModeChange={setPricingMode}
            onAllocationChange={setAllocation}
            onDefaultSoldPriceChange={(v) => set("defaultSoldPrice", v)}
          />
        </div>

        {/* Tasks tab */}
        <div className={tab !== "tasks" ? "hidden" : ""}>
          <TaskListSection
            templateId={template.id}
            tasks={tasks}
            onTasksChange={setTasks}
          />
        </div>

        {/* Sessions tab */}
        <div className={tab !== "sessions" ? "hidden" : ""}>
          <SessionsListSection
            templateId={template.id}
            sessions={sessions}
            onSessionsChange={setSessions}
          />
        </div>
      </div>
    </>
  );
}
