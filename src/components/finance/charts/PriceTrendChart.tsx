"use client";

import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveMonotoneX } from "d3-shape";
import { CHART_TOKENS } from "@/components/charts/ChartTheme";

export interface PriceLine {
  key: string;
  color: string;
  points: { year: number; value: number | null }[];
}

interface PriceTrendProps {
  years: number[];
  series: PriceLine[];
  formatValue: (n: number) => string;
  formatTick: (n: number) => string;
  height?: number;
}

const MARGIN = { top: 8, right: 12, bottom: 28, left: 56 };

function Inner({
  width,
  height,
  years,
  series,
  formatTick,
  formatValue,
}: PriceTrendProps & { width: number; height: number }) {
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const xDomain: [number, number] = minYear === maxYear ? [minYear - 0.5, maxYear + 0.5] : [minYear, maxYear];

  const allValues = series.flatMap((s) => s.points.map((p) => p.value).filter((v): v is number => v != null));
  const maxVal = Math.max(1, ...allValues);

  const xScale = scaleLinear<number>({ domain: xDomain, range: [0, innerW] });
  const yScale = scaleLinear<number>({ domain: [0, maxVal], range: [innerH, 0], nice: true });
  const ticks = yScale.ticks(4);

  return (
    <svg width={width} height={height} role="img">
      <Group left={MARGIN.left} top={MARGIN.top}>
        {ticks.map((t) => (
          <line key={t} x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)} stroke={CHART_TOKENS.gridline} strokeWidth={1} shapeRendering="crispEdges" />
        ))}

        {series.map((s) => (
          <Group key={s.key}>
            <LinePath
              data={s.points}
              x={(d) => xScale(d.year)}
              y={(d) => yScale(d.value ?? 0)}
              defined={(d) => d.value != null}
              stroke={s.color}
              strokeWidth={2}
              curve={curveMonotoneX}
            />
            {s.points
              .filter((p) => p.value != null)
              .map((p) => (
                <circle key={p.year} cx={xScale(p.year)} cy={yScale(p.value as number)} r={3} fill={s.color} stroke={CHART_TOKENS.surface} strokeWidth={1.5}>
                  <title>{`${s.key} · ${p.year}: ${formatValue(p.value as number)}`}</title>
                </circle>
              ))}
          </Group>
        ))}

        <AxisLeft
          scale={yScale}
          tickValues={ticks}
          tickFormat={(v) => formatTick(v as number)}
          stroke={CHART_TOKENS.gridline}
          hideTicks
          tickLabelProps={() => ({ fill: CHART_TOKENS.axis, fontSize: 11, textAnchor: "end", dx: -6, dy: 3 })}
        />
        <AxisBottom
          top={innerH}
          scale={xScale}
          tickValues={years}
          tickFormat={(v) => String(v)}
          stroke={CHART_TOKENS.gridline}
          hideTicks
          tickLabelProps={() => ({ fill: CHART_TOKENS.axis, fontSize: 11, textAnchor: "middle", dy: 4 })}
        />
      </Group>
    </svg>
  );
}

export default function PriceTrendChart(props: PriceTrendProps) {
  const height = props.height ?? 220;
  const hasData = props.years.length > 0 && props.series.some((s) => s.points.some((p) => p.value != null));

  if (!hasData) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: "var(--text-muted)" }}>
        Te weinig data voor een prijsverloop.
      </div>
    );
  }

  return (
    <div>
      <div style={{ height }}>
        <ParentSize>{({ width }) => (width > 0 ? <Inner {...props} width={width} height={height} /> : null)}</ParentSize>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {props.series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-3 h-[3px] rounded-full" style={{ background: s.color }} />
            {s.key}
          </span>
        ))}
      </div>
    </div>
  );
}
