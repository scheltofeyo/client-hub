"use client";

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
import { fmtDate } from "@/lib/utils";

export interface SessionListItem {
  id: string;
  title: string;
  date?: string;
  /** Optional secondary line (e.g. template session info). */
  info?: string;
}

function SessionLabel({ session }: { session: SessionListItem }) {
  return (
    <>
      {session.title}
      {session.date && (
        <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
          · {fmtDate(session.date)}
        </span>
      )}
    </>
  );
}

function SessionRowActions({
  session,
  editable,
  deletable,
  onOpenForm,
  onDelete,
}: {
  session: SessionListItem;
  editable: boolean;
  deletable: boolean;
  onOpenForm: (session?: SessionListItem) => void;
  onDelete: (session: SessionListItem) => void;
}) {
  return (
    <>
      {editable && (
        <button
          type="button"
          onClick={() => onOpenForm(session)}
          className="p-1 rounded-md btn-icon opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          title="Edit session"
          aria-label={`Edit ${session.title}`}
        >
          <Pencil size={12} />
        </button>
      )}
      {deletable && (
        <button
          type="button"
          onClick={() => onDelete(session)}
          className="p-1 rounded-md btn-icon text-[var(--danger)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          title="Delete session"
          aria-label={`Delete ${session.title}`}
        >
          <Trash2 size={12} />
        </button>
      )}
    </>
  );
}

function SortableSessionItem({
  session,
  editable,
  deletable,
  onOpenForm,
  onDelete,
}: {
  session: SessionListItem;
  editable: boolean;
  deletable: boolean;
  onOpenForm: (session?: SessionListItem) => void;
  onDelete: (session: SessionListItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    color: "var(--text-primary)",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 group rounded-md px-2 py-1.5 -mx-2 hover:bg-[var(--bg-hover)]"
    >
      <span
        className="flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ color: "var(--text-muted)" }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </span>
      {editable ? (
        <button
          type="button"
          onClick={() => onOpenForm(session)}
          className="flex-1 min-w-0 text-left text-sm truncate hover:underline"
        >
          <SessionLabel session={session} />
        </button>
      ) : (
        <span className="flex-1 min-w-0 text-sm truncate">
          <SessionLabel session={session} />
        </span>
      )}
      <SessionRowActions
        session={session}
        editable={editable}
        deletable={deletable}
        onOpenForm={onOpenForm}
        onDelete={onDelete}
      />
    </li>
  );
}

/**
 * Shared sessions list used inside an editor panel. It only renders the list and
 * the "new session" affordance; the caller wires `onOpenForm`/`onDelete` to its
 * own form (opened in a stacked panel) so the same list serves both project
 * sessions (`SessionForm`) and template sessions (`TemplateSessionForm`).
 *
 * Pass `onReorder` to enable drag-and-drop ordering (a grip handle appears on
 * hover); the callback receives the reordered session ids.
 */
export default function SessionsListEditor({
  sessions,
  readonly,
  canCreate,
  canEdit,
  canDelete,
  onOpenForm,
  onDelete,
  onReorder,
}: {
  sessions: SessionListItem[];
  readonly: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onOpenForm: (session?: SessionListItem) => void;
  onDelete: (session: SessionListItem) => void;
  onReorder?: (ids: string[]) => void | Promise<void>;
}) {
  const sortable = !readonly && !!onReorder && sessions.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sessions.findIndex((s) => s.id === active.id);
    const newIndex = sessions.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sessions, oldIndex, newIndex);
    onReorder?.(reordered.map((s) => s.id));
  }

  return (
    <div>
      {sessions.length > 0 ? (
        sortable ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1 mb-3">
                {sessions.map((s) => (
                  <SortableSessionItem
                    key={s.id}
                    session={s}
                    editable={!readonly && canEdit}
                    deletable={!readonly && canDelete}
                    onOpenForm={onOpenForm}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="space-y-1 mb-3">
            {sessions.map((s) => {
              const editable = !readonly && canEdit;
              const deletable = !readonly && canDelete;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-2 group rounded-md px-2 py-1.5 -mx-2 hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => onOpenForm(s)}
                      className="flex-1 min-w-0 text-left text-sm truncate hover:underline"
                    >
                      <SessionLabel session={s} />
                    </button>
                  ) : (
                    <span className="flex-1 min-w-0 text-sm truncate">
                      <SessionLabel session={s} />
                    </span>
                  )}
                  <SessionRowActions
                    session={s}
                    editable={editable}
                    deletable={deletable}
                    onOpenForm={onOpenForm}
                    onDelete={onDelete}
                  />
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
          No sessions yet.
        </p>
      )}
      {!readonly && canCreate && (
        <button
          type="button"
          onClick={() => onOpenForm()}
          className="flex items-center gap-1.5 text-xs btn-tertiary"
        >
          <Plus size={12} />
          New session
        </button>
      )}
    </div>
  );
}
