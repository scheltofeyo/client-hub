"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  UserCheck,
} from "lucide-react";
import type { ProjectTemplate, Service, TemplateTask } from "@/types";
import { useRightPanel } from "@/components/layout/RightPanel";
import PageHeader from "@/components/layout/PageHeader";

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

  return (
    <div
      className={`flex items-start gap-2 py-2 group cursor-pointer rounded-lg -mx-2 px-2 ${isSubtask ? "ml-8" : ""}`}
      onClick={() => onEdit(task)}
    >
      {/* Chevron slot (top-level only) */}
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
                  {isExpanded && subs.map((sub) => (
                    <TaskRow
                      key={sub.id}
                      task={sub}
                      isSubtask
                      onEdit={(t) => openEditPanel(t, task)}
                      onDelete={handleDelete}
                    />
                  ))}
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
                      spacerClass="w-[3.75rem]"
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

// ── Tertiary tab bar ──────────────────────────────────────────────────────────

type Tab = "settings" | "tasks";

function TertiaryNav({ tab, onTabChange }: { tab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {(["settings", "tasks"] as Tab[]).map((t) => (
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
          {t === "settings" ? "Settings" : "Tasks"}
        </button>
      ))}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function EditTemplateEditor({
  template,
  initialTasks,
  services,
}: {
  template: ProjectTemplate;
  initialTasks: TemplateTask[];
  services: Service[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [form, setForm] = useState({
    name: template.name,
    description: template.description ?? "",
    defaultDescription: template.defaultDescription ?? "",
    defaultSoldPrice:
      template.defaultSoldPrice != null ? String(template.defaultSoldPrice) : "",
    defaultServiceId: template.defaultServiceId ?? "",
    defaultDeliveryDays:
      template.defaultDeliveryDays != null ? String(template.defaultDeliveryDays) : "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [tasks, setTasks] = useState<TemplateTask[]>(initialTasks);

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
        description: form.description || undefined,
        defaultDescription: form.defaultDescription || undefined,
        defaultSoldPrice: form.defaultSoldPrice ? Number(form.defaultSoldPrice) : undefined,
        defaultServiceId: form.defaultServiceId || undefined,
        defaultDeliveryDays: form.defaultDeliveryDays ? Number(form.defaultDeliveryDays) : undefined,
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

          <div>
            <p className="typo-label">
              Service <span className="text-[var(--danger)]">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => {
                const selected = form.defaultServiceId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => set("defaultServiceId", s.id)}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors"
                    style={
                      selected
                        ? {
                            background: "var(--primary)",
                            borderColor: "var(--primary)",
                            color: "#fff",
                          }
                        : {
                            background: "var(--bg-sidebar)",
                            borderColor: "var(--border)",
                            color: "var(--text-secondary)",
                          }
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="typo-label">
              Short description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Shown to employees when picking a template"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="typo-label">
              Default project description
            </label>
            <textarea
              value={form.defaultDescription}
              onChange={(e) => set("defaultDescription", e.target.value)}
              rows={3}
              placeholder="Pre-fills the project description field…"
              className={inputClass + " resize-none"}
              style={inputStyle}
            />
          </div>

          <div className="!mt-9">
            <p className="typo-section-header mb-3" style={{ color: "var(--text-muted)" }}>
              Financial information
            </p>
            <label className="typo-label">
              Default sold price (€)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.defaultSoldPrice}
              onChange={(e) => set("defaultSoldPrice", e.target.value)}
              placeholder="e.g. 5000"
              className={inputClass}
              style={inputStyle}
            />
          </div>

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

        {/* Tasks tab */}
        <div className={tab !== "tasks" ? "hidden" : ""}>
          <TaskListSection
            templateId={template.id}
            tasks={tasks}
            onTasksChange={setTasks}
          />
        </div>
      </div>
    </>
  );
}
