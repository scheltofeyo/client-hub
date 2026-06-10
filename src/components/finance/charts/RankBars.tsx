"use client";

export interface RankItem {
  id: string;
  label: string;
  value: number;
  sublabel?: string;
  color?: string;
}

interface RankBarsProps {
  items: RankItem[];
  formatValue: (n: number) => string;
  emptyText?: string;
}

export default function RankBars({ items, formatValue, emptyText = "Geen data." }: RankBarsProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
        {emptyText}
      </div>
    );
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>
              {item.label}
            </span>
            <span className="text-[13px] tabular-nums font-medium flex-none" style={{ color: "var(--text-primary)" }}>
              {formatValue(item.value)}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                background: item.color ?? "var(--primary)",
              }}
            />
          </div>
          {item.sublabel && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {item.sublabel}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
