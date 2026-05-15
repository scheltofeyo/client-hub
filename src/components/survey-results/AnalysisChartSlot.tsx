"use client";

import { MCSortedBar, type MCChoiceDatum } from "@/components/charts/MCSortedBar";
import { MCDonut } from "@/components/charts/MCDonut";
import { MCDotMatrix } from "@/components/charts/MCDotMatrix";
import { MCStackedSingleBar } from "@/components/charts/MCStackedSingleBar";
import { RankPodium, type RankItemDatum } from "@/components/charts/RankPodium";
import { RankSortedBar } from "@/components/charts/RankSortedBar";
import { RankVerticalSortedBar } from "@/components/charts/RankVerticalSortedBar";
import { RankHeatmap, type RankHeatmapItem } from "@/components/charts/RankHeatmap";
import { Dumbbell, type DumbbellRow } from "@/components/charts/Dumbbell";
import { Tornado, type TornadoRow } from "@/components/charts/Tornado";
import { SpreadTable } from "@/components/charts/SpreadTable";
import { JaccardTile } from "@/components/charts/JaccardTile";
import { TermFrequencyBars, type TermFrequencyTerm } from "@/components/charts/TermFrequencyBars";
import { SlopeChart, type SlopeRow } from "@/components/charts/SlopeChart";
import { DeltaHistogram, type DeltaHistogramBin } from "@/components/charts/DeltaHistogram";
import { SmallMultiplesLattice, type LatticeSide } from "@/components/charts/SmallMultiplesLattice";
import { BumpChart, type BumpSide } from "@/components/charts/BumpChart";
import {
  GroupedVerticalBars,
  type GroupedVerticalBarsSide,
} from "@/components/charts/GroupedVerticalBars";
import type { AnalysisResult } from "@/lib/surveys/analyses";

interface AnalysisChartSlotProps {
  analysis: AnalysisResult;
  chartKey: string;
}

export function AnalysisChartSlot({ analysis, chartKey }: AnalysisChartSlotProps) {
  if (analysis.compatibilityBroken) {
    return null;
  }

  if (analysis.n === 0 || analysis.sides.length === 0) {
    return <p className="text-xs italic text-text-muted">No responses yet.</p>;
  }

  switch (analysis.operation) {
    case "mc-average":
    case "mc-pooled":
      return renderMCSummary(analysis, chartKey);
    case "archetype-points":
    case "ranking-mean":
      return renderRankSummary(analysis, chartKey);
    case "open-text-frequency":
      return renderOpenTextFrequency(analysis);
    case "delta-2":
      return renderDelta2(analysis, chartKey);
    case "side-by-side-n":
      return renderSideBySide(analysis, chartKey);
    case "paired-delta":
      return renderPairedDelta(analysis, chartKey);
    case "convergence":
      return renderTablePlaceholder(analysis);
    case "top-k-overlap":
      return renderJaccard(analysis);
    default:
      return null;
  }
}

function renderMCSummary(analysis: AnalysisResult, chartKey: string) {
  const side = analysis.sides[0];
  if (!side) return null;
  const choices: MCChoiceDatum[] = analysis.keys.map((k) => {
    const v = side.values.find((x) => x.keyId === k.id)?.value ?? 0;
    return {
      id: k.id,
      label: k.label,
      count: Math.round((v / 100) * side.n),
      percentage: Math.round(v),
    };
  });
  switch (chartKey) {
    case "donut":
      return <MCDonut choices={choices} />;
    case "dot-matrix":
      return <MCDotMatrix choices={choices} />;
    case "stacked-single":
      return <MCStackedSingleBar choices={choices} />;
    case "sorted-bar":
    default:
      return <MCSortedBar choices={choices} />;
  }
}

function renderRankSummary(analysis: AnalysisResult, chartKey: string) {
  const side = analysis.sides[0];
  if (!side) return null;
  const isRankUnit = analysis.unit === "rank";
  const totalPoints = side.values.reduce((s, v) => s + v.value, 0);
  const distById = new Map(
    (side.distributions ?? []).map((d) => [d.keyId, d.counts])
  );

  const items: RankItemDatum[] = analysis.keys.map((k) => {
    const raw = side.values.find((x) => x.keyId === k.id)?.value ?? 0;
    const distribution = distById.get(k.id) ?? [];
    if (isRankUnit) {
      // For mean-rank: smaller is better; invert so higher score = preferred.
      const rankCount = analysis.keys.length;
      const inverted = raw > 0 ? rankCount + 1 - raw : 0;
      return {
        id: k.id,
        label: k.label,
        score: inverted,
        scoreLabel: raw > 0 ? raw.toFixed(1) : "—",
        scoreUnit: raw > 0 ? `avg rank of ${rankCount}` : undefined,
        distribution,
        color: k.color,
      };
    }
    const percentage = totalPoints > 0 ? Math.round((raw / totalPoints) * 100) : 0;
    return {
      id: k.id,
      label: k.label,
      score: percentage,
      scoreLabel: `${percentage}%`,
      scoreUnit: totalPoints > 0 ? `${Math.round(raw)} / ${Math.round(totalPoints)} pts` : undefined,
      distribution,
      color: k.color,
    };
  });

  switch (chartKey) {
    case "podium":
      return <RankPodium items={items} />;
    case "vertical-bar":
      return <RankVerticalSortedBar items={items} />;
    case "heatmap":
      return (
        <RankHeatmap
          items={items.map<RankHeatmapItem>((i) => ({ id: i.id, label: i.label, distribution: i.distribution }))}
        />
      );
    case "sorted-bar":
    default:
      return <RankSortedBar items={items} />;
  }
}

function renderOpenTextFrequency(analysis: AnalysisResult) {
  const side = analysis.sides[0];
  if (!side || side.values.length === 0) {
    return <p className="text-xs italic text-text-muted">No open-text answers yet.</p>;
  }
  const terms: TermFrequencyTerm[] = side.values.map((v) => ({ term: v.keyId, count: v.value }));
  return <TermFrequencyBars terms={terms} rawTexts={analysis.rawTexts} />;
}

function renderDelta2(analysis: AnalysisResult, chartKey: string) {
  const [left, right] = analysis.sides;
  if (!left || !right) return renderTablePlaceholder(analysis);

  if (chartKey === "tornado") {
    const rows: TornadoRow[] = analysis.keys.map((k) => ({
      id: k.id,
      label: k.label,
      leftValue: left.values.find((v) => v.keyId === k.id)?.value ?? 0,
      rightValue: right.values.find((v) => v.keyId === k.id)?.value ?? 0,
      delta: analysis.derived?.find((d) => d.keyId === k.id)?.value ?? 0,
      color: k.color,
    }));
    return (
      <Tornado
        rows={rows}
        unitSuffix={unitSuffix(analysis.unit)}
        leftLabel={left.label}
        rightLabel={right.label}
        leftN={left.n}
        rightN={right.n}
        domainMax={analysis.unit === "percent" ? 100 : undefined}
      />
    );
  }
  if (chartKey === "table") {
    return renderTablePlaceholder(analysis);
  }
  if (chartKey === "grouped-bar") {
    const sides: GroupedVerticalBarsSide[] = analysis.sides.map((s) => ({
      id: s.id,
      label: s.label || s.id,
      values: Object.fromEntries(s.values.map((v) => [v.keyId, v.value])),
      n: s.n,
    }));
    return (
      <GroupedVerticalBars
        sides={sides}
        keys={analysis.keys}
        unitSuffix={unitSuffix(analysis.unit)}
        domainMax={analysis.unit === "percent" ? 100 : undefined}
      />
    );
  }

  const rows: DumbbellRow[] = analysis.keys.map((k) => ({
    id: k.id,
    label: k.label,
    leftValue: left.values.find((v) => v.keyId === k.id)?.value ?? 0,
    rightValue: right.values.find((v) => v.keyId === k.id)?.value ?? 0,
    color: k.color,
  }));
  return (
    <Dumbbell
      rows={rows}
      leftLabel={left.label}
      rightLabel={right.label}
      leftN={left.n}
      rightN={right.n}
      unitSuffix={unitSuffix(analysis.unit)}
      domainMax={analysis.unit === "percent" ? 100 : undefined}
    />
  );
}

function renderSideBySide(analysis: AnalysisResult, chartKey: string) {
  const valuesBySide = analysis.sides.map((s) => ({
    id: s.id,
    label: s.label || s.id,
    values: Object.fromEntries(s.values.map((v) => [v.keyId, v.value])) as Record<string, number>,
    n: s.n,
  }));

  if (chartKey === "lattice") {
    const sides: LatticeSide[] = valuesBySide;
    return (
      <SmallMultiplesLattice
        sides={sides}
        keys={analysis.keys}
        unitSuffix={unitSuffix(analysis.unit)}
      />
    );
  }
  if (chartKey === "bump") {
    // Rank each key within each side. Smaller score is better ONLY for the
    // "ranking-mean" unit; for points / percent, larger is better.
    const ascending = analysis.unit === "rank";
    const sides: BumpSide[] = valuesBySide.map((side) => {
      const sorted = [...analysis.keys]
        .map((k) => ({ id: k.id, v: side.values[k.id] ?? 0 }))
        .sort((a, b) => (ascending ? a.v - b.v : b.v - a.v));
      const ranks: Record<string, number> = {};
      sorted.forEach((entry, idx) => {
        ranks[entry.id] = idx + 1;
      });
      return { id: side.id, label: side.label, ranks };
    });
    return <BumpChart sides={sides} keys={analysis.keys} />;
  }
  if (chartKey === "grouped-bar") {
    const sides: GroupedVerticalBarsSide[] = valuesBySide;
    return (
      <GroupedVerticalBars
        sides={sides}
        keys={analysis.keys}
        unitSuffix={unitSuffix(analysis.unit)}
        domainMax={analysis.unit === "percent" ? 100 : undefined}
      />
    );
  }

  const rows = analysis.keys.map((k) => ({ id: k.id, label: k.label }));
  const spread = Object.fromEntries(
    analysis.derived?.map((d) => [d.keyId, d.value]) ?? []
  ) as Record<string, number>;
  return (
    <SpreadTable
      rows={rows}
      sides={valuesBySide}
      spread={spread}
      unitSuffix={unitSuffix(analysis.unit)}
    />
  );
}

function renderPairedDelta(analysis: AnalysisResult, chartKey: string) {
  const [left, right] = analysis.sides;
  if (!left || !right) return renderTablePlaceholder(analysis);

  if (chartKey === "histogram") {
    const deltas = analysis.derived?.map((d) => d.value) ?? [];
    const bins = histogramBins(deltas, 7);
    return <DeltaHistogram bins={bins} unitSuffix={unitSuffix(analysis.unit)} />;
  }

  const rows: SlopeRow[] = analysis.keys.map((k) => ({
    id: k.id,
    label: k.label,
    leftValue: left.values.find((v) => v.keyId === k.id)?.value ?? 0,
    rightValue: right.values.find((v) => v.keyId === k.id)?.value ?? 0,
  }));
  return (
    <SlopeChart
      rows={rows}
      leftLabel={left.label}
      rightLabel={right.label}
      unitSuffix={unitSuffix(analysis.unit)}
      domainMin={analysis.unit === "percent" ? 0 : undefined}
      domainMax={analysis.unit === "percent" ? 100 : undefined}
    />
  );
}

function histogramBins(values: number[], binCount: number): DeltaHistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return [{ delta: min, count: values.length }];
  const step = range / binCount;
  const bins: DeltaHistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    delta: min + step * (i + 0.5),
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / step));
    bins[idx].count += 1;
  }
  return bins;
}

function renderJaccard(analysis: AnalysisResult) {
  const k = 3;
  const topKLabelsBySide = analysis.sides.map((s) => {
    const labels = s.values
      .filter((v) => v.value > 0)
      .map((v) => {
        const meta = analysis.keys.find((m) => m.id === v.keyId);
        return meta?.label ?? v.keyId;
      });
    return { sideId: s.id, sideLabel: s.label, labels };
  });
  return (
    <JaccardTile
      similarity={analysis.scalar ?? 0}
      sideCount={analysis.sides.length}
      k={k}
      topKLabelsBySide={topKLabelsBySide}
    />
  );
}

function renderTablePlaceholder(analysis: AnalysisResult) {
  return (
    <div className="overflow-auto rounded-card border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-xs">
        <thead style={{ background: "var(--bg-elevated)" }}>
          <tr>
            <th className="text-left px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>Item</th>
            {analysis.sides.map((s) => (
              <th key={s.id} className="text-right px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>
                {s.label || s.id}
              </th>
            ))}
            {analysis.derived && (
              <th className="text-right px-3 py-2 font-medium" style={{ color: "var(--text-muted)" }}>
                {analysis.sides.length === 2 ? "Δ" : "Range"}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {analysis.keys.map((k) => (
            <tr key={k.id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-1.5 truncate max-w-[14rem]" style={{ color: "var(--text-primary)" }}>{k.label}</td>
              {analysis.sides.map((s) => {
                const v = s.values.find((x) => x.keyId === k.id)?.value ?? 0;
                return (
                  <td key={s.id} className="text-right px-3 py-1.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatValue(v, analysis.unit)}
                  </td>
                );
              })}
              {analysis.derived && (
                <td className="text-right px-3 py-1.5 tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatDerived(analysis.derived.find((d) => d.keyId === k.id)?.value ?? 0, analysis.unit)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function unitSuffix(unit: AnalysisResult["unit"]): string {
  if (unit === "percent") return "%";
  if (unit === "points") return " pts";
  if (unit === "rank") return "";
  return "";
}

function formatValue(v: number, unit?: AnalysisResult["unit"]): string {
  if (unit === "percent") return `${Math.round(v)}%`;
  if (unit === "rank") return v.toFixed(1);
  if (unit === "points") return Math.round(v).toString();
  return Math.round(v).toString();
}

function formatDerived(v: number, unit?: AnalysisResult["unit"]): string {
  const sign = v > 0 ? "+" : "";
  if (unit === "percent") return `${sign}${Math.round(v)}%`;
  if (unit === "rank") return `${sign}${v.toFixed(1)}`;
  return `${sign}${Math.round(v)}`;
}
