"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/utils";

export interface SessionListItem {
  id: string;
  title: string;
  date?: string;
  /** Optional secondary line (e.g. template session info). */
  info?: string;
}

/**
 * Shared sessions list used inside an editor panel. It only renders the list and
 * the "new session" affordance; the caller wires `onOpenForm`/`onDelete` to its
 * own form (opened in a stacked panel) so the same list serves both project
 * sessions (`SessionForm`) and template sessions (`TemplateSessionForm`).
 */
export default function SessionsListEditor({
  sessions,
  readonly,
  canCreate,
  canEdit,
  canDelete,
  onOpenForm,
  onDelete,
}: {
  sessions: SessionListItem[];
  readonly: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onOpenForm: (session?: SessionListItem) => void;
  onDelete: (session: SessionListItem) => void;
}) {
  return (
    <div>
      {sessions.length > 0 ? (
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
                    {s.title}
                    {s.date && (
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        · {fmtDate(s.date)}
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="flex-1 min-w-0 text-sm truncate">
                    {s.title}
                    {s.date && (
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        · {fmtDate(s.date)}
                      </span>
                    )}
                  </span>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={() => onOpenForm(s)}
                    className="p-1 rounded-md btn-icon opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    title="Edit session"
                    aria-label={`Edit ${s.title}`}
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {deletable && (
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    className="p-1 rounded-md btn-icon text-[var(--danger)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    title="Delete session"
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
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
