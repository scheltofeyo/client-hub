"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
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
import { useRightPanel } from "@/components/layout/RightPanel";
import { inputClass, inputStyle } from "@/components/ui/form-styles";
import type { TemplateTask } from "@/types";

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

// ── Template task form (shown in a stacked panel) ─────────────────────────────

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
          <label className="typo-label">Parent task</label>
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
        <label className="typo-label">Description</label>
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
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost">
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

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
      <div
        className="flex-shrink-0 w-4 mt-0.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-muted)" }}
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </div>

      {!isSubtask && (
        <div className="flex-shrink-0 w-4 mt-0.5 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
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
              onClick={(e) => {
                e.stopPropagation();
                onAddSubtask(task);
              }}
              className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--primary)" }}
              title="Add subtask"
            >
              <Plus size={13} />
            </button>
          ) : null}
        </div>
      )}

      <div className="flex-shrink-0 w-4 h-4 rounded-full mt-0.5" style={{ background: "var(--primary)", opacity: 0.25 }} />

      <div className="flex-1 min-w-0">
        <p className="text-sm transition-colors group-hover:text-[var(--primary)]" style={{ color: "var(--text-primary)" }}>
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
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="p-1 rounded-md btn-icon">
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
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(task);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                  style={{ color: "var(--text-primary)" }}
                >
                  Edit
                </button>
                {!isSubtask && onAddSubtask && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onAddSubtask(task);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Add subtask
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(task.id);
                  }}
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

// ── Template tasks section ────────────────────────────────────────────────────

export default function TemplateTasksSection({
  templateId,
  tasks,
  onTasksChange,
}: {
  templateId: string;
  tasks: TemplateTask[];
  onTasksChange: (tasks: TemplateTask[]) => void;
}) {
  const { openSecondaryPanel, closeSecondaryPanel } = useRightPanel();
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
    openSecondaryPanel(
      task ? "Edit task" : "Add task",
      <TemplateTaskForm
        templateId={templateId}
        task={task}
        parentTask={parentTask}
        onSaved={(saved) => {
          onTasksChange(tasks.map((t) => (t.id === saved.id ? saved : t)));
        }}
        onClose={closeSecondaryPanel}
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
    const res = await fetch(`/api/project-templates/${templateId}/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) return;
    onTasksChange(tasks.filter((t) => t.id !== taskId && t.parentTaskId !== taskId));
  }

  const topLevel = tasks.filter((t) => !t.parentTaskId);
  const subtasksOf = (parentId: string) => tasks.filter((t) => t.parentTaskId === parentId);

  return (
    <div>
      <div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopLevelDragEnd}>
          <SortableContext items={topLevel.map((t) => t.id)} strategy={verticalListSortingStrategy}>
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
                          <SortableContext items={subs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                            {subs.map((sub) => (
                              <TaskRow key={sub.id} task={sub} isSubtask onEdit={(t) => openEditPanel(t, task)} onDelete={handleDelete} />
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
          onClick={() => {
            setShowingAddInput(true);
            setAddingSubtaskForId(null);
          }}
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
