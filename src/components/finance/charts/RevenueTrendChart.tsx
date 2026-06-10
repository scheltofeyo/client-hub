"use client";

import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { CHART_TOKENS } from "@/components/charts/ChartTheme";

export interface TrendSeries {
  key: string;
  color: string;
}

interface TrendProps {
  periods: string[];
  periodLabel: (p: string) => string;
  series: TrendSeries[];
  valueAt: (period: string, key: string) => number;
  formatValue: (n: number) => string;
  formatTick: (n: number) => string;
  highlight?: string;
  height?: number;
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 56 };

function Inner({
  width,
  height,
  periods,
  periodLabel,
  series,
  valueAt,
  formatValue,
  formatTick,
  highlight,
}: TrendProps & { width: number; height: number }) {
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const totals = periods.map((p) => series.reduce((s, ser) => s + valueAt(p, ser.key), 0));
  const maxTotal = Math.max(1, ...totals);

  const xScale = scaleBand<string>({ domain: periods, range: [0, innerW], padding: 0.32 });
  const yScale = scaleLinear<number>({ domain: [0, maxTotal], range: [innerH, 0], nice: true });
  const ticks = yScale.ticks(4);

  return (
    <svg width={width} height={height} role="img">
      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* gridlines */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={0}
            x2={innerW}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke={CHART_TOKENS.gridline}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
        ))}

        {/* stacked bars */}
        {periods.map((p) => {
          const bw = xScale.bandwidth();
          const x = xScale(p) ?? 0;
          const dim = highlight != null && highlight !== p;
          let acc = 0;
          return (
            <g key={p} opacity={dim ? 0.45 : 1}>
              {series.map((ser) => {
                const v = valueAt(p, ser.key);
                if (v <= 0) return null;
                const y0 = yScale(acc);
                const y1 = yScale(acc + v);
                acc += v;
                return (
                  <rect
                    key={ser.key}
                    x={x}
                    y={y1}
                    width={bw}
                    height={Math.max(0, y0 - y1)}
                    fill={ser.color}
                    stroke={CHART_TOKENS.surface}
                    strokeWidth={1}
                  >
                    <title>{`${periodLabel(p)} · ${ser.key}: ${formatValue(v)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        <AxisLeft
          scale={yScale}
          tickValues={ticks}
          tickFormat={(v) => formatTick(v as number)}
          stroke={CHART_TOKENS.gridline}
          hideTicks
          tickLabelProps={() => ({
            fill: CHART_TOKENS.axis,
            fontSize: 11,
            textAnchor: "end",
            dx: -6,
            dy: 3,
          })}
        />
        <AxisBottom
          top={innerH}
          scale={xScale}
          tickFormat={(p) => periodLabel(p as string)}
          stroke={CHART_TOKENS.gridline}
          hideTicks
          tickLabelProps={() => ({
            fill: CHART_TOKENS.axis,
            fontSize: 11,
            textAnchor: "middle",
            dy: 4,
          })}
        />
      </Group>
    </svg>
  );
}

export default function RevenueTrendChart(props: TrendProps) {
  const height = props.height ?? 240;
  const hasData = props.periods.length > 0 && props.series.length > 0;

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height, color: "var(--text-muted)" }}
      >
        Nog geen afgeronde projecten in deze periode.
      </div>
    );
  }

  return (
    <div>
      <div style={{ height }}>
        <ParentSize>
          {({ width }) => (width > 0 ? <Inner {...props} width={width} height={height} /> : null)}
        </ParentSize>
      </div>
      <Legend series={props.series} />
    </div>
  );
}

function Legend({ series }: { series: TrendSeries[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.key}
        </span>
      ))}
    </div>
  );
}
