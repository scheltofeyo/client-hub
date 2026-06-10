"use client";

import { FolderOpen, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AssigneeAvatars } from "@/components/ui/task-row";
import { fmtDate } from "@/lib/utils";
import { formatEuro } from "./money";
import {
  calculateProjectSubtotal,
  calculateProjectDiscount,
  calculateProjectPayout,
  SECTION_KEYS,
  type DraftProject,
} from "./draft-types";

/**
 * Full-width, one-column card for a draft project on the plan Projects tab.
 * Reuses the ProjectCard visual language but lays it out horizontally and opens
 * the project editor panel on click. Sortable via a visible (not hover-only) grip.
 */
export default function DraftProjectCard({
  project,
  taskCount,
  sessionCount,
  readonly,
  canRemove,
  sortDisabled,
  onOpen,
  onRemove,
}: {
  project: DraftProject;
  taskCount: number;
  sessionCount: number;
  readonly: boolean;
  canRemove: boolean;
  sortDisabled: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled: sortDisabled,
  });

  const subtotal = calculateProjectSubtotal(project);
  const discount = calculateProjectDiscount(project);
  const net = subtotal - discount;
  const payout = calculateProjectPayout(project);
  const hiddenCount = (project.hiddenSections ?? []).filter((s) => (SECTION_KEYS as readonly string[]).includes(s)).length;

  const dateRange =
    project.scheduledStartDate && project.scheduledEndDate
      ? `${fmtDate(project.scheduledStartDate)} → ${fmtDate(project.scheduledEndDate)}`
      : project.scheduledStartDate
        ? `From ${fmtDate(project.scheduledStartDate)}`
        : null;

  const metaParts = [
    `${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`,
    `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`,
  ];
  if (hiddenCount > 0) metaParts.push(`${hiddenCount} hidden`);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
      }}
      className="group relative flex items-stretch rounded-xl border bg-white dark:bg-[var(--bg-sidebar)] project-card-hover"
    >
      {!sortDisabled && (
        <button
          type="button"
          className="flex items-center px-2 cursor-grab active:cursor-grabbing touch-none shrink-0 rounded-l-xl"
          style={{ color: "var(--text-muted)" }}
          aria-label="Reorder project"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 flex-1 min-w-0 text-left py-3.5 pr-3"
        style={{ paddingLeft: sortDisabled ? 16 : 4 }}
      >
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)" }}
        >
          <FolderOpen size={16} style={{ color: "var(--text-muted)" }} />
        </span>

        <span className="flex flex-col min-w-0 gap-0.5">
          <span className="flex items-center gap-1.5">
            {project.serviceName && (
              <span className="typo-tag leading-none truncate" style={{ color: "var(--text-muted)" }}>
                {project.serviceName}
              </span>
            )}
            {dateRange && (
              <span className="text-xs leading-none truncate" style={{ color: "var(--text-muted)" }}>
                {project.serviceName ? "· " : ""}
                {dateRange}
              </span>
            )}
          </span>
          <span className="font-medium text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>
            {project.title || "Untitled project"}
          </span>
          <span className="text-xs leading-none" style={{ color: "var(--text-muted)" }}>
            {metaParts.join(" · ")}
          </span>
        </span>

        <span className="flex-1" />

        <span className="flex flex-col items-end shrink-0">
          <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
            {discount > 0 && (
              <span className="mr-1.5 line-through font-normal" style={{ color: "var(--text-muted)" }}>
                {formatEuro(subtotal)}
              </span>
            )}
            {formatEuro(net)}
          </span>
          {discount > 0 && (
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              − {formatEuro(discount)} discount
            </span>
          )}
          {payout > 0 && (
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--text-muted)" }}
              title="Pay-out to externals · Net revenue (internal only)"
            >
              − {formatEuro(payout)} ext · {formatEuro(net - payout)} net
            </span>
          )}
        </span>

        {(project.members ?? []).length > 0 && (
          <span className="shrink-0 ml-1">
            <AssigneeAvatars assignees={project.members ?? []} size={26} />
          </span>
        )}
      </button>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center px-3 shrink-0 btn-icon text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-r-xl"
          title="Remove from plan"
          aria-label={`Remove ${project.title || "project"} from plan`}
        >
          <Trash2 size={14} />
        </button>
      )}
      {readonly && !canRemove && <span className="px-2" />}
    </div>
  );
}
