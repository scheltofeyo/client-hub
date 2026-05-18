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
import type { QuestionResult, ResultsArchetype } from "./types";

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
    return null;
  }, [question.type, choiceMode]);

  const defaultChartKey =
    question.type === "multiple-choice"
      ? "sorted-bar"
      : question.type === "archetype-ranking" ||
          question.type === "archetype-top3" ||
          question.type === "general-ranking" ||
          question.type === "general-top3"
        ? "podium"
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
    const items: RankItemDatum[] = question.items.map((i) => {
      // Invert avg-rank so larger score = preferred.
      const inverted = i.averageRank > 0 ? rankCount + 1 - i.averageRank : 0;
      return {
        id: i.itemId,
        label: i.text || "(no text)",
        score: inverted,
        scoreLabel: i.averageRank > 0 ? i.averageRank.toFixed(1) : "—",
        scoreUnit: i.averageRank > 0 ? `avg rank of ${rankCount}` : undefined,
        distribution: i.distribution,
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
