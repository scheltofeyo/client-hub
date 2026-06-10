"use client";

import { type ReactNode } from "react";

/**
 * A labelled group inside an editor panel tab. Gives each tab a backbone:
 * a small uppercase section header (+ optional helper line and right-aligned
 * action) over a tightly-spaced field stack. Wrap several sections in a
 * `space-y-8` container so groups read tight-within / generous-between.
 */
export default function PanelSection({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {(title || description || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                {title}
              </h3>
            )}
            {description && <p className="typo-caption mt-1">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
