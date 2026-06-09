"use client";

import { ShieldCheck, FileEdit, Eye } from "lucide-react";

export type EditorMode = "template" | "snapshot" | "readonly";

export interface ModeChipProps {
  mode: EditorMode;
  /** Used by snapshot mode to show the client / session context (e.g. "Acme · Q2 culture survey"). */
  context?: string;
}

const CONFIG: Record<
  EditorMode,
  { label: string; icon: React.ComponentType<{ size?: number }>; bg: string; fg: string }
> = {
  template: {
    label: "Admin · Template",
    icon: ShieldCheck,
    bg: "var(--info-light)",
    fg: "var(--info)",
  },
  snapshot: {
    label: "Session draft",
    icon: FileEdit,
    bg: "var(--warning-light)",
    fg: "var(--warning)",
  },
  readonly: {
    label: "Read-only",
    icon: Eye,
    bg: "var(--bg-neutral)",
    fg: "var(--text-muted)",
  },
};

export default function ModeChip({ mode, context }: ModeChipProps) {
  const cfg = CONFIG[mode];
  const Icon = cfg.icon;
  const label = mode === "snapshot" && context ? `${cfg.label} · ${context}` : cfg.label;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide shrink-0"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
