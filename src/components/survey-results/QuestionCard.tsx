"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChartPicker, type ChartOption } from "./ChartPicker";
import { CopyChartButton } from "./CopyChartButton";
import { OpenAnswerList } from "./OpenAnswerList";
import { MCSortedBar, type MCChoiceDatum } from "@/components/charts/MCSortedBar";
import { MCDonut } from "@/components/charts/MCDonut";
import { MCDotMatrix } from "@/components/charts/MCDotMatrix";
import { MCStackedSingleBar } from "@/components/charts/MCStackedSingleBar";
import { RankPodium, type RankItemDatum } from "@/components/charts/RankPodium";
import { RankSortedBar } from "@/components/charts/RankSortedBar";
import { RankVerticalSortedBar } from "@/components/charts/RankVerticalSortedBar";
import { RankHeatmap, type RankHeatmapItem } from "@/components/charts/RankHeatmap";
import { RankTopOneShareBar, type RankTopOneItem } from "@/components/charts/RankTopOneShareBar";
import { RankTintedStack, type RankTintedItem } from "@/components/charts/RankTintedStack";
import { ScaleDotPlot } from "@/components/charts/ScaleDotPlot";
import { LikertDivergingBar } from "@/components/charts/LikertDivergingBar";
import { ScaleMeanSpread } from "@/components/charts/ScaleMeanSpread";
import { scalePoints, type ScaleBounds, type ScaleSeries } from "@/components/charts/scale-series";
import type { QuestionResult, ResultsArchetype } from "./types";

/**
 * Distribution first, summary second.
 *
 * The bar is what drives a training conversation — "half the group sits at 2"
 * is actionable in a way a mean of 3.1 is not. Mean and SD sit underneath as
 * supporting numbers, and SD is deliberately not dressed up as precise: at the
 * group sizes these surveys see, small differences in it are noise.
 */
function ScaleReadout({
  min,
  max,
  mean,
  sd,
  distribution,
  n,
}: {
  min: number;
  max: number;
  mean: number | null;
  sd: number | null;
  distribution: number[];
  n: number;
}) {
  const total = distribution.reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    return <p className="text-xs italic text-text-muted">No responses yet.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {distribution.map((count, i) => {
          const point = min + i;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={point} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right text-xs tabular-nums text-text-muted">
                {point}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded-badge bg-neutral">
                <div
                  className="h-full rounded-badge"
                  style={{ width: `${pct}%`, background: "var(--primary)" }}
                />
              </div>
              <span className="w-16 shrink-0 text-xs tabular-nums text-text-muted">
                {count} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="typo-caption">
        n = {n} · mean {mean ?? "—"} of {max} · spread (SD) {sd ?? "—"}
      </p>
    </div>
  );
}

interface QuestionCardProps {
  question: QuestionResult;
  archetypes: ResultsArchetype[];
  introBodyByQuestionId?: Record<string, string>;
  /** Controlled expansion. If omitted, the card manages its own state. */
  open?: boolean;
  onToggle?: () => void;
}

const MC_OPTIONS_SINGLE: ChartOption[] = [
  { key: "sorted-bar", label: "Sorted bar" },
  { key: "donut", label: "Donut" },
  { key: "dot-matrix", label: "Dot matrix" },
  { key: "stacked-single", label: "Stacked bar" },
];

const MC_OPTIONS_MULTI: ChartOption[] = [
  { key: "sorted-bar", label: "Sorted bar" },
  { key: "dot-matrix", label: "Dot matrix" },
];

/**
 * Ordered-scale views. The dot plot leads because at these group sizes the
 * individual answers are the conversation; the other four each surface one
 * thing it cannot — shape across many values, the ranking, the raw counts.
 */
const VALUE_ASSESSMENT_OPTIONS: ChartOption[] = [
  { key: "dots", label: "Dots" },
  { key: "likert", label: "Likert bar" },
  { key: "mean-spread", label: "Mean & spread" },
  { key: "heatmap", label: "Heatmap" },
  { key: "histogram", label: "Histogram" },
];

// A single scale question is one row, so the ranking and grid views have
// nothing to compare and are left out.
const SCALE_OPTIONS: ChartOption[] = [
  { key: "dots", label: "Dots" },
  { key: "likert", label: "Likert bar" },
  { key: "histogram", label: "Histogram" },
];

/**
 * Value-ranking mirrors the archetype-ranking views, minus the vertical bar —
 * cultural value titles are long enough that rotated axis labels stop being
 * readable. "Rank spread" is the one that is specific to this question type.
 */
const VALUE_RANKING_OPTIONS: ChartOption[] = [
  { key: "podium", label: "Podium" },
  { key: "sorted-bar", label: "Sorted bar" },
  { key: "rank-spread", label: "Rank spread" },
  { key: "heatmap", label: "Heatmap" },
  { key: "top-one", label: "Top-1 share" },
  { key: "table", label: "Table" },
];

const RANK_OPTIONS: ChartOption[] = [
  { key: "podium", label: "Podium" },
  { key: "sorted-bar", label: "Sorted bar" },
  { key: "vertical-bar", label: "Vertical bar" },
  { key: "heatmap", label: "Heatmap" },
  { key: "top-one", label: "Top-1 share" },
];

export function QuestionCard({
  question,
  archetypes,
  introBodyByQuestionId,
  open: openProp,
  onToggle,
}: QuestionCardProps) {
  const [openLocal, setOpenLocal] = useState(true);
  const open = openProp ?? openLocal;
  const handleToggle = onToggle ?? (() => setOpenLocal((o) => !o));

  const choiceMode = question.type === "multiple-choice" ? question.choiceMode : undefined;
  const pickerOptions: ChartOption[] | null = useMemo(() => {
    if (question.type === "multiple-choice") {
      return choiceMode === "multi" ? MC_OPTIONS_MULTI : MC_OPTIONS_SINGLE;
    }
    if (
      question.type === "archetype-ranking" ||
      question.type === "archetype-top3" ||
      question.type === "general-ranking" ||
      question.type === "general-top3"
    ) {
      return RANK_OPTIONS;
    }
    if (question.type === "value-assessment") return VALUE_ASSESSMENT_OPTIONS;
    if (question.type === "value-ranking") return VALUE_RANKING_OPTIONS;
    if (question.type === "scale") return SCALE_OPTIONS;
    return null;
  }, [question.type, choiceMode]);

  const defaultChartKey =
    question.type === "multiple-choice"
      ? "sorted-bar"
      : question.type === "archetype-ranking" ||
          question.type === "archetype-top3" ||
          question.type === "general-ranking" ||
          question.type === "general-top3" ||
          question.type === "value-ranking"
        ? "podium"
        : question.type === "value-assessment" || question.type === "scale"
          ? "dots"
          : null;

  const [chartKey, setChartKey] = useState<string>(defaultChartKey ?? "");

  const chartSlot = renderChartSlot({
    question,
    archetypes,
    chartKey: chartKey || (defaultChartKey ?? ""),
    introBodyByQuestionId,
  });

  const chartRef = useRef<HTMLDivElement>(null);
  const canCopyChart =
    open &&
    question.type !== "intro" &&
    question.type !== "open-text" &&
    question.n > 0;

  return (
    <section className="overflow-hidden rounded-card bg-surface shadow-card">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-4">
        <button
          type="button"
          onClick={handleToggle}
          className="flex min-w-0 flex-1 items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-expanded={open}
        >
          <h3
            className="min-w-0 flex-1 text-base font-semibold leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {question.title || (question.type === "intro" ? "Info block" : "(untitled)")}
          </h3>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {question.type !== "intro" && (
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              n = {question.n}
            </span>
          )}
          {canCopyChart && (
            <CopyChartButton chartRef={chartRef} title={question.title} />
          )}
          <button
            type="button"
            onClick={handleToggle}
            className="p-1"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
          >
            {open ? (
              <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
            ) : (
              <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="px-5 py-5">
            {pickerOptions && question.n > 0 && (
              <div className="mb-5">
                <ChartPicker
                  options={pickerOptions}
                  value={chartKey || (defaultChartKey ?? "")}
                  onChange={setChartKey}
                />
              </div>
            )}
            <div ref={chartRef} className="min-h-[160px]">{chartSlot}</div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * One switch for every ordered-scale question, so a plain scale question and a
 * value-assessment row cannot drift into rendering the same numbers differently.
 * `histogram` is the original per-point bar readout, kept as an option.
 */
function renderScaleView(
  chartKey: string,
  series: ScaleSeries[],
  bounds: ScaleBounds,
  rowHeader: string,
  groupN: number,
  histogram: React.ReactNode
): React.ReactNode {
  switch (chartKey) {
    case "likert":
      return <LikertDivergingBar series={series} bounds={bounds} groupN={groupN} />;
    case "mean-spread":
      return <ScaleMeanSpread series={series} bounds={bounds} groupN={groupN} />;
    case "heatmap":
      return (
        <RankHeatmap
          items={series.map((s) => ({ id: s.id, label: s.label, distribution: s.distribution }))}
          columnLabels={scalePoints(bounds).map(String)}
          rowHeader={rowHeader}
          columnNoun="score"
        />
      );
    case "histogram":
      return histogram;
    default:
      return <ScaleDotPlot series={series} bounds={bounds} groupN={groupN} />;
  }
}

function renderChartSlot(args: {
  question: QuestionResult;
  archetypes: ResultsArchetype[];
  chartKey: string;
  introBodyByQuestionId?: Record<string, string>;
}): React.ReactNode {
  const { question, archetypes, chartKey, introBodyByQuestionId } = args;

  if (question.type === "intro") {
    const html = introBodyByQuestionId?.[question.questionId] ?? "";
    if (!html) {
      return <p className="text-xs italic text-text-muted">Info block.</p>;
    }
    return (
      <div
        className="prose prose-sm max-w-none text-sm leading-relaxed"
        style={{ color: "var(--text-primary)" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (question.type === "open-text") {
    if (question.answers.length === 0)
      return <p className="text-xs italic text-text-muted">No responses yet.</p>;
    return <OpenAnswerList answers={question.answers} />;
  }

  if (question.n === 0) {
    return <p className="text-xs italic text-text-muted">No responses yet.</p>;
  }

  if (question.type === "scale") {
    const bounds: ScaleBounds = { min: question.min, max: question.max };
    const series: ScaleSeries[] = [
      {
        id: question.questionId,
        label: question.title || "Score",
        n: question.n,
        mean: question.mean,
        sd: question.sd,
        distribution: question.distribution,
      },
    ];
    return renderScaleView(chartKey, series, bounds, "Question", question.n, (
      <ScaleReadout
        min={question.min}
        max={question.max}
        mean={question.mean}
        sd={question.sd}
        distribution={question.distribution}
        n={question.n}
      />
    ));
  }

  if (question.type === "value-assessment") {
    const bounds: ScaleBounds = { min: question.min, max: question.max };
    const series: ScaleSeries[] = question.values.map((v) => ({
      id: v.valueItemId,
      label: v.title,
      color: v.color,
      n: v.n,
      mean: v.mean,
      sd: v.sd,
      distribution: v.distribution,
    }));
    return renderScaleView(chartKey, series, bounds, "Value", question.n, (
      <div className="space-y-5">
        {question.values.map((v) => (
          <div key={v.valueItemId}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: v.color }}
                aria-hidden="true"
              />
              <span className="typo-card-title text-text-primary">{v.title}</span>
            </div>
            <ScaleReadout
              min={question.min}
              max={question.max}
              mean={v.mean}
              sd={v.sd}
              distribution={v.distribution}
              n={v.n}
            />
          </div>
        ))}
      </div>
    ));
  }

  if (question.type === "value-ranking") {
    const rankCount = Math.max(
      1,
      question.values.length,
      ...question.values.map((v) => v.distribution.length)
    );
    // Sorted by mean rank so the group's ordering is the first thing you read.
    const sorted = [...question.values].sort(
      (a, b) => (a.meanRank ?? Infinity) - (b.meanRank ?? Infinity)
    );
    const fmtRank = (r: number | null) =>
      r === null ? "—" : r.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
    const items: RankItemDatum[] = sorted.map((v) => ({
      id: v.valueItemId,
      label: v.title,
      // Inverted: the rank charts all read `score` as "larger sits higher", and
      // a mean rank is the other way round — 1 is the best a value can do.
      score: v.meanRank === null ? 0 : rankCount + 1 - v.meanRank,
      scoreLabel: fmtRank(v.meanRank),
      scoreUnit: `avg rank of ${rankCount}`,
      distribution: v.distribution,
      color: v.color,
    }));

    switch (chartKey) {
      case "sorted-bar":
        return <RankSortedBar items={items} />;
      case "rank-spread":
        return (
          <RankTintedStack
            items={sorted.map<RankTintedItem>((v) => ({
              id: v.valueItemId,
              label: v.title,
              color: v.color,
              distribution: v.distribution,
              meanRank: v.meanRank,
            }))}
            ranks={rankCount}
          />
        );
      case "heatmap":
        return (
          <RankHeatmap
            items={items.map<RankHeatmapItem>((i) => ({
              id: i.id,
              label: i.label,
              distribution: i.distribution,
            }))}
            ranks={rankCount}
            rowHeader="Value"
          />
        );
      case "top-one":
        return (
          <RankTopOneShareBar
            items={items.map<RankTopOneItem>((i) => ({
              id: i.id,
              label: i.label,
              topOneCount: i.distribution[0] ?? 0,
              color: i.color,
            }))}
            n={question.n}
          />
        );
      case "table":
        break;
      case "podium":
      default:
        return <RankPodium items={items} />;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="typo-section-header pb-2 text-text-muted">Value</th>
              <th className="typo-section-header pb-2 text-right text-text-muted">
                Mean rank
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.valueItemId} className="border-t border-border-default">
                <td className="py-2">
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: v.color }}
                    aria-hidden="true"
                  />
                  <span className="text-text-primary">{v.title}</span>
                </td>
                <td className="py-2 text-right tabular-nums text-text-primary">
                  {fmtRank(v.meanRank)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (question.type === "multiple-choice") {
    const choices: MCChoiceDatum[] = question.distribution.map((d) => ({
      id: d.choiceId,
      label: d.text || "(no text)",
      count: d.count,
      percentage: d.percentage,
    }));
    const isMulti = question.choiceMode === "multi";
    switch (chartKey) {
      case "donut":
        return isMulti ? <MCSortedBar choices={choices} /> : <MCDonut choices={choices} />;
      case "dot-matrix":
        return <MCDotMatrix choices={choices} />;
      case "stacked-single":
        return isMulti
          ? <MCSortedBar choices={choices} />
          : <MCStackedSingleBar choices={choices} />;
      case "sorted-bar":
      default:
        return <MCSortedBar choices={choices} />;
    }
  }

  if (question.type === "archetype-ranking" || question.type === "archetype-top3") {
    const totalPoints = question.totalPoints;
    const items: RankItemDatum[] = archetypes.map((a) => {
      const archResult = question.archetypes.find((x) => x.archetypeId === a.id);
      const percentage = archResult?.percentage ?? 0;
      const points = archResult?.points ?? 0;
      const distribution = question.rankDistribution[a.id] ?? [];
      return {
        id: a.id,
        label: a.name,
        score: percentage,
        scoreLabel: `${percentage}%`,
        scoreUnit: totalPoints > 0 ? `${points} / ${totalPoints} pts` : undefined,
        distribution,
        color: a.color,
      };
    });
    switch (chartKey) {
      case "sorted-bar":
        return <RankSortedBar items={items} />;
      case "vertical-bar":
        return <RankVerticalSortedBar items={items} />;
      case "heatmap":
        return (
          <RankHeatmap
            items={items.map<RankHeatmapItem>((i) => ({ id: i.id, label: i.label, distribution: i.distribution }))}
          />
        );
      case "top-one":
        return (
          <RankTopOneShareBar
            items={items.map<RankTopOneItem>((i) => ({
              id: i.id,
              label: i.label,
              topOneCount: i.distribution[0] ?? 0,
              color: i.color,
            }))}
            n={question.n}
          />
        );
      case "podium":
      default:
        return <RankPodium items={items} />;
    }
  }

  if (question.type === "general-ranking" || question.type === "general-top3") {
    const rankCount = Math.max(1, ...question.items.map((i) => i.distribution.length));
    const totalPoints = question.totalPoints;
    // General ranking items don't have a meaningful source order — sort them
    // by score descending so the highest-scoring item leads. (Archetype
    // rankings keep their DB rank order; sort is done per question type.)
    const items: RankItemDatum[] = question.items
      .map((i) => ({
        id: i.itemId,
        label: i.text || "(no text)",
        score: i.percentage,
        scoreLabel: `${i.percentage}%`,
        scoreUnit: totalPoints > 0 ? `${i.points} / ${totalPoints} pts` : undefined,
        distribution: i.distribution,
      }))
      .sort((a, b) => b.score - a.score);
    switch (chartKey) {
      case "sorted-bar":
        return <RankSortedBar items={items} />;
      case "vertical-bar":
        return <RankVerticalSortedBar items={items} />;
      case "heatmap":
        return (
          <RankHeatmap
            items={items.map<RankHeatmapItem>((i) => ({ id: i.id, label: i.label, distribution: i.distribution }))}
            ranks={rankCount}
          />
        );
      case "top-one":
        return (
          <RankTopOneShareBar
            items={items.map<RankTopOneItem>((i) => ({
              id: i.id,
              label: i.label,
              topOneCount: i.distribution[0] ?? 0,
            }))}
            n={question.n}
          />
        );
      case "podium":
      default:
        return <RankPodium items={items} />;
    }
  }

  return null;
}
