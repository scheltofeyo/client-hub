"use client";

import { type ReactNode } from "react";

/**
 * Review primitives for "final check" steps — a titled card of rows, where each
 * row shows a label + value and can flip into an inline editor.
 *
 * Shared by the kickoff modal (KickOffProjectButton) and the New Project modal
 * (AddProjectButton) so the two review steps stay visually identical.
 */

export function SummaryRow({
  label,
  value,
  warning,
  caption,
  onEdit,
  editing = false,
  onDone,
  editor,
}: {
  label: string;
  value: ReactNode;
  /** Shown instead of the value; forces the editor open when one is provided */
  warning?: string;
  /** Small muted helper under the value (read-only context, e.g. "From template") */
  caption?: ReactNode;
  onEdit?: () => void;
  editing?: boolean;
  onDone?: () => void;
  /** Inline editor (carries its own field label) shown while editing */
  editor?: ReactNode;
}) {
  if (editing && editor) {
    return (
      <div className="px-4 py-3 space-y-2">
        {editor}
        {warning ? (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {warning}
          </p>
        ) : (
          onDone && (
            <div className="flex justify-end">
              <button type="button" onClick={onDone} className="btn-link text-[13px]">
                Done
              </button>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className="w-24 shrink-0 text-[13px] font-medium pt-px"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm"
          style={{ color: warning ? "var(--danger)" : "var(--text-primary)" }}
        >
          {warning ?? value}
        </div>
        {!warning && caption && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {caption}
          </p>
        )}
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="btn-link text-[13px] shrink-0">
          Edit
        </button>
      )}
    </div>
  );
}

export function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="typo-section-header mb-2" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <div
        className="rounded-xl border divide-y divide-[var(--border)]"
        style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
      >
        {children}
      </div>
    </div>
  );
}
