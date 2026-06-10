interface SecondaryKpi {
  label: string;
  value: string;
  tone?: "default" | "muted";
}

interface KpiStripProps {
  primary: { label: string; value: string; hint?: string };
  secondary: SecondaryKpi[];
}

/**
 * One card, not a grid of identical cards. The primary metric carries weight
 * (typo-metric); secondary metrics sit in a divided inline row at smaller
 * scale. Numbers render in ink for contrast; labels are measured.
 */
export default function KpiStrip({ primary, secondary }: KpiStripProps) {
  return (
    <div
      className="rounded-card border p-5 flex flex-wrap items-end gap-x-8 gap-y-5"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="pr-2">
        <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          {primary.label}
        </p>
        <p className="typo-metric mt-1.5" style={{ color: "var(--text-primary)" }}>
          {primary.value}
        </p>
        {primary.hint && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {primary.hint}
          </p>
        )}
      </div>

      {secondary.map((kpi) => (
        <div key={kpi.label} className="pl-8 border-l" style={{ borderColor: "var(--border)" }}>
          <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>
            {kpi.label}
          </p>
          <p
            className="text-xl font-semibold tabular-nums mt-1.5"
            style={{ color: kpi.tone === "muted" ? "var(--text-muted)" : "var(--text-primary)" }}
          >
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );
}
