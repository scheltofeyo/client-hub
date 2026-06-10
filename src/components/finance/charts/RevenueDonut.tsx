"use client";

import { ParentSize } from "@visx/responsive";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { CHART_TOKENS } from "@/components/charts/ChartTheme";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  formatValue: (n: number) => string;
  height?: number;
}

function Ring({
  width,
  height,
  segments,
  centerValue,
  centerLabel,
  formatValue,
  total,
}: DonutProps & { width: number; height: number; total: number }) {
  const radius = Math.max(0, Math.min(width, height) / 2 - 2);
  const inner = radius * 0.64;

  return (
    <svg width={width} height={height} role="img">
      <Group top={height / 2} left={width / 2}>
        <Pie
          data={segments}
          pieValue={(d) => d.value}
          outerRadius={radius}
          innerRadius={inner}
          padAngle={0.012}
        >
          {(pie) =>
            pie.arcs.map((arc) => {
              const path = pie.path(arc) ?? undefined;
              const pct = total > 0 ? Math.round((arc.data.value / total) * 100) : 0;
              return (
                <path key={arc.data.id} d={path} fill={arc.data.color} stroke={CHART_TOKENS.surface} strokeWidth={1.5}>
                  <title>{`${arc.data.label}: ${formatValue(arc.data.value)} (${pct}%)`}</title>
                </path>
              );
            })
          }
        </Pie>
        <text textAnchor="middle" dy={-2} style={{ fill: CHART_TOKENS.textPrimary, fontSize: 18, fontWeight: 600 }}>
          {centerValue}
        </text>
        <text textAnchor="middle" dy={16} style={{ fill: CHART_TOKENS.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {centerLabel}
        </text>
      </Group>
    </svg>
  );
}

export default function RevenueDonut(props: DonutProps) {
  const height = props.height ?? 180;
  const total = props.segments.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: "var(--text-muted)" }}>
        Geen data.
      </div>
    );
  }

  // Largest first for a stable, readable legend.
  const ordered = [...props.segments].sort((a, b) => b.value - a.value);

  return (
    <div>
      <div style={{ height }}>
        <ParentSize>
          {({ width }) => (width > 0 ? <Ring {...props} width={width} height={height} total={total} /> : null)}
        </ParentSize>
      </div>
      <div className="flex flex-col gap-1 mt-3">
        {ordered.map((s) => {
          const pct = Math.round((s.value / total) * 100);
          return (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: s.color }} />
              <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{s.label}</span>
              <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{props.formatValue(s.value)}</span>
              <span className="tabular-nums w-9 text-right" style={{ color: "var(--text-muted)" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
