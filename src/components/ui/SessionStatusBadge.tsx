"use client";

export type SessionStatus = "draft" | "open" | "closed" | "archived";

type StatusConfig = { label: string; dotColor: string; bgColor: string; textColor: string };

export const SESSION_STATUS_CONFIG: Record<SessionStatus, StatusConfig> = {
  draft: { label: "Draft", dotColor: "var(--info)", bgColor: "var(--info-light)", textColor: "var(--info)" },
  open: { label: "Open", dotColor: "var(--success)", bgColor: "var(--success-light)", textColor: "var(--success)" },
  closed: { label: "Closed", dotColor: "var(--text-muted)", bgColor: "var(--bg-hover)", textColor: "var(--text-muted)" },
  archived: { label: "Archived", dotColor: "var(--border)", bgColor: "var(--bg-hover)", textColor: "var(--text-muted)" },
};

export const SESSION_STATUS_FILTER_ORDER: SessionStatus[] = ["open", "draft", "closed", "archived"];

export function getSessionStatusConfig(status: string): StatusConfig {
  return SESSION_STATUS_CONFIG[status as SessionStatus] ?? SESSION_STATUS_CONFIG.draft;
}

export function SessionStatusBadge({ status }: { status: string }) {
  const cfg = getSessionStatusConfig(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0"
      style={{ background: cfg.bgColor, color: cfg.textColor }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dotColor }} />
      {cfg.label}
    </span>
  );
}

export function SessionStatusFilterChips({
  counts,
  active,
  onToggle,
}: {
  counts: Record<string, number>;
  active: string[];
  onToggle: (status: string) => void;
}) {
  const visible = SESSION_STATUS_FILTER_ORDER.filter((s) => (counts[s] ?? 0) > 0);
  if (visible.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-4">
      {visible.map((status) => {
        const cfg = SESSION_STATUS_CONFIG[status];
        const isActive = active.includes(status);
        const count = counts[status] ?? 0;
        return (
          <button
            key={status}
            onClick={() => onToggle(status)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm font-medium transition-colors"
            style={{
              background: isActive ? "var(--primary-light)" : "var(--bg-hover)",
              color: isActive ? "var(--primary)" : "var(--text-muted)",
              border: isActive ? "1px solid var(--primary)" : "1px solid transparent",
              opacity: isActive ? 1 : 0.8,
            }}
          >
            {cfg.label}
            <span className="text-xs" style={{ opacity: 0.6 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
