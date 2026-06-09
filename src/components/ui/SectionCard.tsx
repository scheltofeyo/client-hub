"use client";

import { useId } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

export type SectionCardTone = "warning" | "danger" | "info";
export type SectionCardVariant = "default" | "nested";

export interface SectionCardProps {
  title?: string;
  breadcrumb?: string;
  helper?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  stickyFooter?: boolean;
  variant?: SectionCardVariant;
  tone?: SectionCardTone;
  locked?: boolean;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}

const TONE_RAIL: Record<SectionCardTone, string> = {
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

export default function SectionCard({
  title,
  breadcrumb,
  helper,
  action,
  footer,
  stickyFooter,
  variant = "default",
  tone,
  locked,
  ariaLabel,
  className,
  children,
}: SectionCardProps) {
  const hasHeader = !!(title || breadcrumb || helper || action || locked);
  const isNested = variant === "nested";
  const reactId = useId();
  const lockDescId = locked ? `${reactId}-lock-desc` : undefined;

  const outerStyle: React.CSSProperties = {
    background: locked
      ? "var(--bg-neutral)"
      : isNested
        ? "var(--bg-elevated)"
        : "var(--bg-surface)",
    borderColor: isNested ? "transparent" : "var(--border)",
    borderWidth: isNested ? 0 : 1,
    borderStyle: "solid",
    boxShadow: isNested ? "none" : "var(--shadow-subtle)",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? title ?? undefined}
      aria-disabled={locked || undefined}
      aria-describedby={lockDescId}
      className={cn(
        isNested ? "rounded-button" : "rounded-card",
        className
      )}
      style={outerStyle}
      data-section-card
      data-variant={variant}
    >
      {/* Tone left-rail (decorative; nested variant ignores) */}
      {tone && !isNested && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 3, background: TONE_RAIL[tone] }}
        />
      )}

      {hasHeader && (
        <div
          className={cn(
            "flex items-center gap-3",
            isNested ? "px-4 py-3" : "px-5 py-4",
            !isNested && "border-b"
          )}
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0 flex-1">
            {breadcrumb && (
              <p className="typo-section-header mb-1" style={{ color: "var(--text-muted)" }}>
                {breadcrumb}
              </p>
            )}
            {(title || locked) && (
              <div className="flex items-center gap-2 min-w-0">
                {locked && (
                  <Lock size={12} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                )}
                {title && (
                  <span className="typo-card-title truncate" style={{ color: "var(--text-primary)" }}>
                    {title}
                  </span>
                )}
                {helper && (
                  <span className="text-xs truncate ml-2" style={{ color: "var(--text-muted)" }}>
                    {helper}
                  </span>
                )}
              </div>
            )}
            {!title && helper && !locked && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{helper}</p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div
        className={isNested ? "p-4" : "p-6"}
        style={
          locked
            ? { opacity: 0.6, pointerEvents: "none" }
            : undefined
        }
      >
        {children}
      </div>

      {footer && (
        <div
          className={cn(
            "flex items-center gap-3 border-t",
            isNested ? "px-4 py-3" : "px-5 py-3",
            stickyFooter && "sticky bottom-0"
          )}
          style={{
            borderColor: "var(--border)",
            background: isNested ? "var(--bg-elevated)" : "var(--bg-surface)",
          }}
        >
          {footer}
        </div>
      )}

      {locked && (
        <span id={lockDescId} className="sr-only">
          Locked because the session is published.
        </span>
      )}
    </div>
  );
}
