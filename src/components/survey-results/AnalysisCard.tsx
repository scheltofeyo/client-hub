"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { ChartPicker, type ChartOption } from "./ChartPicker";
import { AnalysisChartSlot } from "./AnalysisChartSlot";
import { AnalysisKebabMenu } from "./AnalysisKebabMenu";
import { CopyChartButton } from "./CopyChartButton";
import type { AnalysisResult } from "@/lib/surveys/analyses";

interface AnalysisCardProps {
  analysis: AnalysisResult;
  description: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const MC_OPTIONS: ChartOption[] = [
  { key: "sorted-bar", label: "Sorted bar" },
  { key: "donut", label: "Donut" },
  { key: "dot-matrix", label: "Dot matrix" },
  { key: "stacked-single", label: "Stacked bar" },
];

const RANK_OPTIONS: ChartOption[] = [
  { key: "podium", label: "Podium" },
  { key: "sorted-bar", label: "Sorted bar" },
  { key: "vertical-bar", label: "Vertical bar" },
  { key: "heatmap", label: "Heatmap" },
];

const DELTA2_OPTIONS: ChartOption[] = [
  { key: "grouped-bar", label: "Grouped bars" },
  { key: "dumbbell", label: "Dumbbell" },
  { key: "tornado", label: "Tornado" },
  { key: "table", label: "Table" },
];

const SIDE_BY_SIDE_OPTIONS: ChartOption[] = [
  { key: "grouped-bar", label: "Grouped bars" },
  { key: "spread", label: "Spread table" },
  { key: "lattice", label: "Lattice" },
  { key: "bump", label: "Bump chart" },
];

const PAIRED_DELTA_OPTIONS: ChartOption[] = [
  { key: "slope", label: "Slope" },
  { key: "histogram", label: "Histogram" },
];

export function AnalysisCard({
  analysis,
  description,
  canEdit,
  isFirst,
  isLast,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: AnalysisCardProps) {
  const [open, setOpen] = useState(true);

  const pickerOptions = pickerOptionsForOperation(analysis.operation);
  const defaultChartKey =
    analysis.operation === "mc-average" || analysis.operation === "mc-pooled"
      ? "sorted-bar"
      : analysis.operation === "archetype-points"
        ? "podium"
        : analysis.operation === "ranking-mean"
          ? "sorted-bar"
          : analysis.operation === "delta-2"
            ? "grouped-bar"
            : analysis.operation === "side-by-side-n"
              ? "grouped-bar"
              : analysis.operation === "paired-delta"
                ? "slope"
                : "";
  const [chartKey, setChartKey] = useState<string>(analysis.chartKey ?? defaultChartKey);

  const chartRef = useRef<HTMLDivElement>(null);
  const canCopyChart = open && !analysis.compatibilityBroken && analysis.n > 0;

  const accent = analysis.compatibilityBroken ? "var(--danger)" : "var(--primary)";
  const typeBadge = analysis.type === "summary" ? "Summary" : "Comparison";

  return (
    <section
      data-analysis-id={analysis.id}
      className="overflow-hidden rounded-card bg-surface shadow-card relative"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: accent }} aria-hidden="true" />
      <div className="pl-3">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand min-w-0"
            aria-expanded={open}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="typo-tag rounded-badge px-1.5 py-0.5"
                  style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                >
                  Analysis
                </span>
                <span
                  className="typo-tag rounded-badge px-1.5 py-0.5"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                >
                  {typeBadge}
                </span>
              </div>
              <h3
                className="text-base font-semibold leading-snug truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {analysis.title || "(untitled)"}
              </h3>
              {description && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              )}
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              n = {analysis.n}
            </span>
            {canCopyChart && (
              <CopyChartButton chartRef={chartRef} title={analysis.title} />
            )}
            <AnalysisKebabMenu
              canEdit={canEdit}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              canMoveUp={!isFirst}
              canMoveDown={!isLast}
            />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="p-1"
              aria-label={open ? "Collapse" : "Expand"}
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
              {analysis.compatibilityBroken ? (
                <BrokenState onEdit={onEdit} />
              ) : (
                <>
                  {pickerOptions.length > 1 && analysis.n > 0 && (
                    <div className="mb-5">
                      <ChartPicker
                        options={pickerOptions}
                        value={chartKey || defaultChartKey}
                        onChange={setChartKey}
                      />
                    </div>
                  )}
                  <div ref={chartRef} className="min-h-[160px]">
                    <AnalysisChartSlot analysis={analysis} chartKey={chartKey || defaultChartKey} />
                  </div>
                  {metricExplanation(analysis) && (
                    <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {metricExplanation(analysis)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BrokenState({ onEdit }: { onEdit?: () => void }) {
  return (
    <div className="text-center py-6">
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        A question used in this analysis was changed. Edit to fix.
      </p>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="btn-primary inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-button text-sm"
        >
          <Pencil size={13} />
          Edit analysis
        </button>
      )}
    </div>
  );
}

function metricExplanation(a: AnalysisResult): string {
  switch (a.operation) {
    case "mc-average":
      return "Each value is the % of respondents who picked that option, averaged across the questions in this analysis.";
    case "mc-pooled":
      return "Selections are pooled across all questions in this analysis, then divided by the pooled respondent count.";
    case "archetype-points":
      return "Each value is the total ranking points per archetype, summed across the questions in this analysis.";
    case "ranking-mean":
      return "Each value is the mean rank position per item (lower = preferred), averaged across the questions.";
    case "open-text-frequency":
      return "Counts show how often each term appears across all open-text answers in this analysis.";
    case "delta-2":
      if (a.unit === "rank") {
        return "Each side shows the mean rank per item (lower = preferred), averaged across that side's questions. Δ is the difference in rank positions.";
      }
      return "Each side shows the % share per item within a question, averaged across that side's questions. Δ is in percentage points.";
    case "side-by-side-n":
      if (a.unit === "rank") {
        return "Each side shows the mean rank per item, averaged across that side's questions. Range = max − min across all sides.";
      }
      return "Each side shows the % share per item within a question, averaged across that side's questions. Range = max − min across all sides.";
    case "top-k-overlap":
      return "Top-3 items per side; Jaccard similarity is the intersection of those top-3 lists divided by their union.";
    case "paired-delta":
      if (a.unit === "rank") {
        return "Each respondent's per-item rank in side A minus side B; mean delta across all respondents who answered both sides.";
      }
      return "Each respondent's per-item % share in side A minus side B; mean delta across all respondents who answered both sides.";
    case "convergence":
      return "Convergence shows per-item agreement across all sides (1 = identical values, 0 = maximum disagreement).";
    default:
      return "";
  }
}

function pickerOptionsForOperation(operation: AnalysisResult["operation"]): ChartOption[] {
  switch (operation) {
    case "mc-average":
    case "mc-pooled":
      return MC_OPTIONS;
    case "archetype-points":
    case "ranking-mean":
      return RANK_OPTIONS;
    case "delta-2":
      return DELTA2_OPTIONS;
    case "side-by-side-n":
      return SIDE_BY_SIDE_OPTIONS;
    case "paired-delta":
      return PAIRED_DELTA_OPTIONS;
    default:
      return [];
  }
}
