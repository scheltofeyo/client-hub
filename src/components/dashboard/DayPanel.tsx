"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  icon: LucideIcon;
  count?: number;
  countSuffix?: string;
  isEmpty: boolean;
  emptyIcon: LucideIcon;
  emptyLabel: string;
  children?: ReactNode;
}

/** Shared surface module for the day-detail columns. */
export default function DayPanel({
  title,
  icon: Icon,
  count,
  countSuffix,
  isEmpty,
  emptyIcon: EmptyIcon,
  emptyLabel,
  children,
}: Props) {
  return (
    <section
      className="flex flex-col rounded-card border p-4 shadow-subtle"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} style={{ color: "var(--text-muted)" }} />
        <h3 className="typo-card-title flex-1" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        {count != null && count > 0 && (
          <span
            className="rounded-badge px-2 py-0.5 text-xs font-semibold tabular-nums"
            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
          >
            {count}
            {countSuffix ? ` ${countSuffix}` : ""}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10">
          <EmptyIcon size={22} style={{ color: "var(--text-muted)" }} />
          <p className="typo-caption" style={{ color: "var(--text-muted)" }}>
            {emptyLabel}
          </p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
