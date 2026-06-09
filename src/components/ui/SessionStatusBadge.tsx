"use client";

export type SessionStatus = "draft" | "open" | "closed" | "archived";

type StatusConfig = { label: string; dotColor: string; bgColor: string; textColor: string };

export const SESSION_STATUS_CONFIG: Record<SessionStatus, StatusConfig> = {
  draft: { label: "Draft", dotColor: "var(--info)", bgColor: "var(--info-light)", textColor: "var(--info)" },
  open: { label: "Open", dotColor: "var(--success)", bgColor: "var(--success-light)", textColor: "var(--success)" },
  closed: { label: "Closed", dotColor: "var(--text-muted)", bgColor: "var(--bg-neutral)", textColor: "var(--text-muted)" },
  archived: { label: "Archived", dotColor: "var(--border)", bgColor: "var(--bg-neutral)", textColor: "var(--text-muted)" },
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
  return (
    <div className="flex items-center gap-2 mb-4">
      {SESSION_STATUS_FILTER_ORDER.map((status) => {
        const cfg = SESSION_STATUS_CONFIG[status];
        const count = counts[status] ?? 0;
        const disabled = count === 0;
        const isActive = active.includes(status) && !disabled;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(status)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm font-medium transition-colors disabled:cursor-not-allowed"
            style={{
              background: isActive ? "var(--primary-light)" : "var(--bg-neutral)",
              color: isActive ? "var(--primary)" : "var(--text-muted)",
              border: isActive ? "1px solid var(--primary)" : "1px solid transparent",
              opacity: disabled ? 0.4 : isActive ? 1 : 0.8,
            }}
          >
            {cfg.label}
            <span className="text-xs tabular-nums" style={{ opacity: 0.6 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
