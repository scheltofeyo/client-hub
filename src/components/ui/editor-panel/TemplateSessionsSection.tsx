"use client";

import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { TemplateSession } from "@/types";

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
      body: JSON.stringify({ title: title.trim(), info: info.trim() || undefined }),
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
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost">
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

function SortableSessionRow({
  ts,
  onEdit,
  onDelete,
}: {
  ts: TemplateSession;
  onEdit: (ts: TemplateSession) => void;
  onDelete: (ts: TemplateSession) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ts.id,
  });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    borderColor: "var(--border)",
  };

  return (
    <div ref={setNodeRef} style={dragStyle} className="flex items-start gap-2 py-2 border-b group">
      <div
        className="flex-shrink-0 w-4 mt-0.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-muted)" }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </div>
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
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(ts)}
          className="btn-icon p-1.5 rounded-md"
          aria-label={`Edit ${ts.title}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(ts)}
          className="btn-icon p-1.5 rounded-md text-[var(--danger)]"
          aria-label={`Delete ${ts.title}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function TemplateSessionsSection({
  templateId,
  sessions,
  onSessionsChange,
}: {
  templateId: string;
  sessions: TemplateSession[];
  onSessionsChange: (sessions: TemplateSession[]) => void;
}) {
  const { openSecondaryPanel, closeSecondaryPanel } = useRightPanel();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sessions.findIndex((s) => s.id === active.id);
    const newIndex = sessions.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sessions, oldIndex, newIndex);
    onSessionsChange(reordered);
    await fetch(`/api/project-templates/${templateId}/sessions/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
    });
  }

  function openCreate() {
    openSecondaryPanel(
      "Add session",
      <TemplateSessionForm
        templateId={templateId}
        onSaved={(saved) => onSessionsChange([...sessions, saved])}
        onClose={closeSecondaryPanel}
      />
    );
  }

  function openEdit(ts: TemplateSession) {
    openSecondaryPanel(
      "Edit session",
      <TemplateSessionForm
        templateId={templateId}
        templateSession={ts}
        onSaved={(saved) => onSessionsChange(sessions.map((s) => (s.id === saved.id ? saved : s)))}
        onClose={closeSecondaryPanel}
      />
    );
  }

  async function handleDelete(ts: TemplateSession) {
    if (!confirm(`Delete "${ts.title}"?`)) return;
    const res = await fetch(`/api/project-templates/${templateId}/sessions/${ts.id}`, { method: "DELETE" });
    if (!res.ok) return;
    onSessionsChange(sessions.filter((s) => s.id !== ts.id));
  }

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
        Sessions are workshops or meetings with the client. When a project is created from this template, each
        session is added as a draft and a &ldquo;Plan {"{title}"}&rdquo; task is generated.
      </p>

      {sessions.length === 0 && (
        <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
          No sessions yet.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sessions.map((ts) => (
            <SortableSessionRow key={ts.id} ts={ts} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </SortableContext>
      </DndContext>

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
