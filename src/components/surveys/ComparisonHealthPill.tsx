"use client";

import { AlertTriangle, Check, Circle, AlertOctagon } from "lucide-react";

export type ComparisonHealth = "empty" | "incomplete" | "ready" | "needs-attention";

export interface ComparisonHealthPillProps {
  health: ComparisonHealth;
  /** Optional sample size to suffix the Ready label (`Ready · n=24`). */
  n?: number;
  /** Optional override text. Falls back to the canonical label. */
  label?: string;
}

const CONFIG: Record<
  ComparisonHealth,
  { defaultLabel: string; icon: React.ComponentType<{ size?: number }>; bg: string; fg: string }
> = {
  empty: {
    defaultLabel: "Empty",
    icon: Circle,
    bg: "var(--bg-hover)",
    fg: "var(--text-muted)",
  },
  incomplete: {
    defaultLabel: "Incomplete",
    icon: AlertTriangle,
    bg: "var(--warning-light)",
    fg: "var(--warning)",
  },
  ready: {
    defaultLabel: "Ready",
    icon: Check,
    bg: "var(--success-light)",
    fg: "var(--success)",
  },
  "needs-attention": {
    defaultLabel: "Needs attention",
    icon: AlertOctagon,
    bg: "var(--danger-light)",
    fg: "var(--danger)",
  },
};

export default function ComparisonHealthPill({ health, n, label }: ComparisonHealthPillProps) {
  const cfg = CONFIG[health];
  const Icon = cfg.icon;
  const text = label ?? (health === "ready" && typeof n === "number" ? `Ready · n=${n}` : cfg.defaultLabel);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
      <Icon size={12} />
      {text}
    </span>
  );
}

/**
 * Helper that derives `ComparisonHealth` from a comparison + the survey's known question-ids.
 * Mirrors Appendix B §6 of the redesign plan.
 */
export function deriveComparisonHealth({
  leftQuestionIds,
  rightQuestionIds,
  knownQuestionIds,
}: {
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  knownQuestionIds: Set<string>;
}): { health: ComparisonHealth; orphaned: string[] } {
  const orphanedLeft = leftQuestionIds.filter((q) => !knownQuestionIds.has(q));
  const orphanedRight = rightQuestionIds.filter((q) => !knownQuestionIds.has(q));
  const orphaned = [...orphanedLeft, ...orphanedRight];

  const left = leftQuestionIds.length - orphanedLeft.length;
  const right = rightQuestionIds.length - orphanedRight.length;

  if (orphaned.length > 0) return { health: "needs-attention", orphaned };
  if (left === 0 && right === 0) return { health: "empty", orphaned };
  if (left === 0 || right === 0) return { health: "incomplete", orphaned };
  return { health: "ready", orphaned };
}
