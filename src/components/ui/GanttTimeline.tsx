"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// ── Public types ─────────────────────────────────────────────────────────────

export type GanttVariant = "active" | "upcoming" | "muted";

/** A single bar within a multi-bar row (e.g. one project inside a service row). */
export interface GanttBar {
  id: string;        // unique identifier (e.g. project ID)
  label: string;     // text shown inside the bar (e.g. project title)
  start: Date;
  end: Date;
  variant: GanttVariant;
}

export interface GanttRow {
  id: string;
  label: string;       // left-column label (e.g. service name)
  sublabel?: string;
  start: Date;          // envelope min — used for window calculation
  end: Date;            // envelope max — used for window calculation
  variant: GanttVariant;
  /** When set, renders multiple bars on this row instead of a single bar. */
  bars?: GanttBar[];
}

export interface GanttSection {
  key: string;
  label: string;
  rows: GanttRow[];
  defaultCollapsed?: boolean;
  /** When set, bars are shown on the section header row while collapsed. */
  summaryBars?: { start: Date; end: Date; variant: GanttVariant }[];
  /** Optional icon rendered before the label (e.g. client avatar). */
  icon?: React.ReactNode;
}

interface GanttTimelineProps {
  sections: GanttSection[];
  onBarClick?: (barId: string) => void;
  renderHoverCard?: (barId: string, x: number, y: number) => React.ReactNode;
  /** Override pixels per day to zoom in/out (default: 5). */
  pxPerDay?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PX_PER_DAY = 12;
const LABEL_COL = 180;
const ROW_H = 44;
const AXIS_H = 32;
const SECTION_H = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ── Style constants ──────────────────────────────────────────────────────────

const STYLES = {
  outerWrapper: {
    borderColor: "var(--border)",
    overflow: "clip" as const,
    width: "100%",
    maxWidth: "100%",
    contain: "inline-size" as const,
  },
  axisBar: {
    zIndex: 30,
    height: AXIS_H,
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
  },
  labelColSpacer: {
    width: LABEL_COL,
    minWidth: LABEL_COL,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
  },
  labelCol: {
    width: LABEL_COL,
    minWidth: LABEL_COL,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    overflowX: "clip" as const,
  },
  axisScroll: {
    flex: 1,
    minWidth: 0,
    overflowX: "hidden" as const,
    position: "relative" as const,
  },
  chartPanel: {
    flex: 1,
    minWidth: 0,
    overflowX: "auto" as const,
  },
  sectionHeader: {
    height: SECTION_H,
    borderBottom: "1px solid var(--border)",
    background: "var(--text-muted-light, color-mix(in srgb, var(--text-muted) 6%, var(--bg-surface)))",
  },
  sectionSpacer: {
    height: SECTION_H,
    borderBottom: "1px solid var(--border)",
    background: "var(--text-muted-light, color-mix(in srgb, var(--text-muted) 6%, var(--bg-surface)))",
    position: "relative" as const,
    zIndex: 2,
  },
  rowBase: {
    height: ROW_H,
    borderBottom: "1px solid var(--border)",
  },
} as const;

// ── Pure helpers ─────────────────────────────────────────────────────────────

function toPx(windowStart: Date, d: Date, scale: number = PX_PER_DAY): number {
  return Math.max(0, ((d.getTime() - windowStart.getTime()) / MS_PER_DAY) * scale);
}

function widthPx(start: Date, end: Date, scale: number = PX_PER_DAY): number {
  return Math.max(4, ((end.getTime() - start.getTime()) / MS_PER_DAY) * scale);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getMonthSteps(
  windowStart: Date,
  windowEnd: Date,
  scale: number = PX_PER_DAY
): { label: string; leftPx: number }[] {
  const steps: { label: string; leftPx: number }[] = [];
  const cur = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  let isFirst = true;
  while (cur <= windowEnd) {
    const px = toPx(windowStart, cur, scale);
    const monthShort = cur.toLocaleDateString("en-GB", { month: "short" });
    const year = cur.getFullYear().toString().slice(2);
    const showYear = isFirst || cur.getMonth() === 0;
    steps.push({
      label: showYear ? `1 ${monthShort} '${year}` : `1 ${monthShort}`,
      leftPx: px,
    });
    isFirst = false;
    cur.setMonth(cur.getMonth() + 1);
  }
  return steps;
}

function computeWindow(
  allRows: GanttRow[],
  today: Date
): { windowStart: Date; windowEnd: Date } {
  // Minimum: today + 3 months so there's always some future visible.
  const minEnd = new Date(today.getFullYear(), today.getMonth() + 3, 1);

  if (allRows.length === 0) {
    return {
      windowStart: new Date(today.getFullYear(), today.getMonth(), 1),
      windowEnd: minEnd,
    };
  }

  const earliest = new Date(Math.min(...allRows.map((r) => r.start.getTime())));
  const windowStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

  const latestEnd = new Date(Math.max(...allRows.map((r) => r.end.getTime())));
  const latestEndBoundary = new Date(
    latestEnd.getFullYear(),
    latestEnd.getMonth() + 2,
    1
  );
  const windowEnd = new Date(
    Math.max(latestEndBoundary.getTime(), minEnd.getTime())
  );

  return { windowStart, windowEnd };
}

function variantStyle(variant: GanttVariant): React.CSSProperties {
  if (variant === "upcoming") {
    return {
      background: "var(--primary-light)",
      border: "1.5px dashed var(--primary)",
      color: "var(--primary)",
    };
  }
  if (variant === "muted") {
    return { background: "var(--border)", color: "var(--text-muted)" };
  }
  return { background: "var(--primary)", color: "#fff" };
}

// ── Flat item list ───────────────────────────────────────────────────────────

type FlatItem =
  | { kind: "section"; section: GanttSection; isCollapsed: boolean }
  | { kind: "row"; row: GanttRow };

function flattenSections(
  sections: GanttSection[],
  collapsed: Record<string, boolean>
): FlatItem[] {
  const items: FlatItem[] = [];
  for (const section of sections) {
    if (section.rows.length === 0) continue;
    const isCollapsed = collapsed[section.key] ?? false;
    items.push({ kind: "section", section, isCollapsed });
    if (!isCollapsed) {
      for (const row of section.rows) {
        items.push({ kind: "row", row });
      }
    }
  }
  return items;
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Month grid lines — rendered behind items (z-index 0). */
function GridLines({ monthSteps }: { monthSteps: { label: string; leftPx: number }[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {monthSteps.map((m) => (
        <div
          key={m.leftPx}
          style={{
            position: "absolute",
            left: m.leftPx,
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

/** Today vertical line in the chart body — no label (label lives in MonthAxis). */
function TodayOverlay({ todayLeftPx }: { todayLeftPx: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <div
        style={{
          position: "absolute",
          left: todayLeftPx,
          top: 0,
          bottom: 0,
          width: 2,
          background: "var(--primary)",
          opacity: 0.4,
        }}
      />
    </div>
  );
}

/** Sticky month axis header with tick lines and labels. */
function MonthAxis({
  axisRef,
  monthSteps,
  chartWidth,
  todayLeftPx,
  showTodayLine,
}: {
  axisRef: React.RefObject<HTMLDivElement | null>;
  monthSteps: { label: string; leftPx: number }[];
  chartWidth: number;
  todayLeftPx: number;
  showTodayLine: boolean;
}) {
  return (
    /* position:sticky + top:0 scopes to the PAGE (not this element)
       because the outer wrapper uses overflow:clip, not overflow:hidden. */
    <div className="flex select-none" style={STYLES.axisBar}>
      <div style={STYLES.labelColSpacer} />
      {/* overflowX:'hidden' — creates a scroll container so JS can set
         scrollLeft for sync, while hiding the scrollbar. Safe here because
         sticky positioning of the axis depends on the OUTER wrapper's
         overflow:clip, not this element's overflow. */}
      <div ref={axisRef} style={STYLES.axisScroll}>
        <div style={{ position: "relative", height: AXIS_H, width: chartWidth }}>
          {monthSteps.map((m) => (
            <div
              key={`tick-${m.leftPx}`}
              style={{
                position: "absolute",
                left: m.leftPx,
                top: 0,
                bottom: 0,
                width: 1,
                background: "var(--border)",
                pointerEvents: "none",
              }}
            />
          ))}
          {monthSteps.map((m) => (
            <span
              key={`label-${m.leftPx}`}
              className="text-[10px] font-medium"
              style={{
                position: "absolute",
                left: m.leftPx + 4,
                top: "50%",
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
                color: "var(--text-muted)",
              }}
            >
              {m.label}
            </span>
          ))}
          {/* Today marker — sits on the bottom edge of the axis header */}
          {showTodayLine && (
            <span
              className="text-[9px] font-semibold"
              style={{
                position: "absolute",
                left: todayLeftPx + 4,
                bottom: 2,
                color: "var(--primary)",
                whiteSpace: "nowrap",
              }}
            >
              Today
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Collapsible section header in the left label column. */
function SectionHeader({
  section,
  isCollapsed,
  onToggle,
}: {
  section: GanttSection;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  const hasSummary = !!section.summaryBars?.length;
  const isClientRow = hasSummary || !!section.icon;
  return (
    <div
      className="flex items-center gap-1.5 px-3 cursor-pointer select-none"
      style={{ ...STYLES.sectionHeader, height: hasSummary ? ROW_H : SECTION_H }}
      onClick={onToggle}
    >
      <Chevron size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      {section.icon}
      <span
        className={isClientRow ? "text-xs font-medium truncate" : "typo-tag"}
        style={{ color: isClientRow ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {section.label}
      </span>
      <span
        className="text-[10px]"
        style={{ color: "var(--text-muted)", opacity: 0.6 }}
      >
        {section.rows.length}
      </span>
    </div>
  );
}

/** Right-panel spacer for section rows. Renders summary bars when collapsed. */
function SectionSpacer({
  section,
  isCollapsed,
  windowStart,
  scale,
}: {
  section: GanttSection;
  isCollapsed: boolean;
  windowStart: Date;
  scale: number;
}) {
  const hasSummary = !!section.summaryBars?.length;
  const h = hasSummary ? ROW_H : SECTION_H;

  if (isCollapsed && section.summaryBars?.length) {
    return (
      <div style={{ ...STYLES.sectionSpacer, height: h, position: "relative" }}>
        {section.summaryBars.map((bar, i) => {
          const leftPx = toPx(windowStart, bar.start, scale);
          const barW = widthPx(bar.start, bar.end, scale);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: leftPx,
                width: barW,
                top: "50%",
                transform: "translateY(-50%)",
                height: 24,
                borderRadius: 6,
                zIndex: 2,
                ...variantStyle(bar.variant),
              }}
            />
          );
        })}
      </div>
    );
  }

  return <div style={{ ...STYLES.sectionSpacer, height: h }} />;
}

/** Row label in the left frozen column. */
function LabelCell({
  row,
  isHovered,
  onHover,
}: {
  row: GanttRow;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      className="px-3 py-2 transition-colors"
      style={{
        ...STYLES.rowBase,
        background: isHovered ? "var(--primary-light)" : "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
    >
      <p
        className="text-xs font-medium truncate"
        style={{ color: "var(--text-primary)" }}
        title={row.label}
      >
        {row.label}
      </p>
      {row.sublabel && (
        <p
          className="text-[10px] truncate mt-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          {row.sublabel}
        </p>
      )}
    </div>
  );
}

/** Project bar(s) in the right scrollable chart panel. */
function BarCell({
  row,
  windowStart,
  scale,
  isHovered,
  onHover,
  onBarClick,
  onBarMouseEnter,
  onBarMouseMove,
  onBarMouseLeave,
}: {
  row: GanttRow;
  windowStart: Date;
  scale: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onBarClick?: (barId: string) => void;
  onBarMouseEnter: (e: React.MouseEvent, barId: string) => void;
  onBarMouseMove: (e: React.MouseEvent) => void;
  onBarMouseLeave: () => void;
}) {
  // Multi-bar row: render each bar individually
  const bars: GanttBar[] = row.bars ?? [
    { id: row.id, label: `${fmtShort(row.start)} – ${fmtShort(row.end)}`, start: row.start, end: row.end, variant: row.variant },
  ];

  return (
    <div
      className="transition-colors"
      style={{
        ...STYLES.rowBase,
        background: isHovered ? "var(--primary-light)" : "transparent",
        position: "relative",
      }}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
    >
      {bars.map((bar) => {
        const leftPx = toPx(windowStart, bar.start, scale);
        const barW = widthPx(bar.start, bar.end, scale);
        return (
          <div
            key={bar.id}
            style={{
              position: "absolute",
              left: leftPx,
              width: barW,
              top: "50%",
              transform: "translateY(-50%)",
              height: 24,
              borderRadius: 6,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              paddingLeft: 8,
              paddingRight: 8,
              overflow: "clip",
              cursor: onBarClick ? "pointer" : "default",
              ...variantStyle(bar.variant),
            }}
            onClick={() => onBarClick?.(bar.id)}
            onMouseEnter={(e) => onBarMouseEnter(e, bar.id)}
            onMouseMove={onBarMouseMove}
            onMouseLeave={onBarMouseLeave}
          >
            <span
              className="text-[10px] font-medium truncate"
              style={{
                color: "inherit",
                position: "sticky",
                left: 0,
              }}
            >
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GanttTimeline({
  sections,
  onBarClick,
  renderHoverCard,
  pxPerDay,
}: GanttTimelineProps) {
  const effectivePxPerDay = pxPerDay ?? PX_PER_DAY;
  const axisRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of sections) init[s.key] = s.defaultCollapsed ?? false;
    return init;
  });
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoverCard, setHoverCard] = useState<{
    barId: string;
    x: number;
    y: number;
  } | null>(null);

  // ── Window + chart geometry ──────────────────────────────────────────────
  const allRows = sections.flatMap((s) => s.rows);
  const { windowStart, windowEnd } = computeWindow(allRows, today);
  const chartWidth = Math.round(
    ((windowEnd.getTime() - windowStart.getTime()) / MS_PER_DAY) * effectivePxPerDay
  );
  const monthSteps = getMonthSteps(windowStart, windowEnd, effectivePxPerDay);
  const todayLeftPx = toPx(windowStart, today, effectivePxPerDay);
  const showTodayLine = todayLeftPx > 0 && todayLeftPx < chartWidth;

  const items = flattenSections(sections, collapsed);

  // ── Scroll to today before first paint (no flash) ────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // Position today near the left edge, with ~2 weeks of history visible
    const scrollTo = Math.max(0, todayLeftPx - 14 * effectivePxPerDay);
    chart.scrollLeft = scrollTo;
    if (axisRef.current) axisRef.current.scrollLeft = scrollTo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep axis in sync with chart scroll ──────────────────────────────────
  const handleChartScroll = useCallback(() => {
    if (axisRef.current && chartRef.current) {
      axisRef.current.scrollLeft = chartRef.current.scrollLeft;
    }
  }, []);

  // ── Bar hover ────────────────────────────────────────────────────────────
  const handleBarMouseEnter = useCallback(
    (e: React.MouseEvent, barId: string) => {
      setHoverCard({ barId, x: e.clientX, y: e.clientY });
    },
    []
  );
  const handleBarMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverCard((prev) =>
      prev ? { ...prev, x: e.clientX, y: e.clientY } : null
    );
  }, []);
  const handleBarMouseLeave = useCallback(() => setHoverCard(null), []);

  const toggleSection = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (allRows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No items to display.
      </p>
    );
  }

  return (
    <>
      {/*
        IMPORTANT: overflow:'clip' here, NOT 'hidden'.
        overflow:'hidden' creates a scroll container which scopes
        position:sticky children to THIS element instead of the page.
        overflow:'clip' clips visually without becoming a scroll container
        — sticky children scope to the nearest scrolling ancestor (the page).

        width + maxWidth:'100%' caps this element at the parent's computed
        width regardless of child content width (3660px+ inner chart div).
      */}
      <div
        className="rounded-xl border"
        style={STYLES.outerWrapper}
        suppressHydrationWarning
      >
        <MonthAxis
          axisRef={axisRef}
          monthSteps={monthSteps}
          chartWidth={chartWidth}
          todayLeftPx={todayLeftPx}
          showTodayLine={showTodayLine}
        />

        {/* ── Two-panel body ──────────────────────────────────────────── */}
        <div style={{ display: "flex" }}>
          {/* LEFT: frozen label column
              IMPORTANT: overflowX:'clip' so long labels are clipped without
              creating a scroll container (which would break sticky headers). */}
          <div style={STYLES.labelCol}>
            {items.map((item) =>
              item.kind === "section" ? (
                <SectionHeader
                  key={item.section.key}
                  section={item.section}
                  isCollapsed={item.isCollapsed}
                  onToggle={() => toggleSection(item.section.key)}
                />
              ) : (
                <LabelCell
                  key={item.row.id}
                  row={item.row}
                  isHovered={hoveredRowId === item.row.id}
                  onHover={setHoveredRowId}
                />
              )
            )}
          </div>

          {/* RIGHT: scrollable chart panel
              IMPORTANT: overflowX:'auto' ONLY here. This is the sole scroll
              container. The axis and section headers use overflow:clip. */}
          <div
            ref={chartRef}
            style={STYLES.chartPanel}
            onScroll={handleChartScroll}
          >
            {/*
              Exact fixed width — never minWidth or width:100%.
              chartWidth is always >= today + 24 months (~3 660 px) so it is
              always wider than the chart panel, guaranteeing a scrollbar and
              complete grid-line coverage.
            */}
            <div style={{ width: chartWidth, position: "relative" }}>
              <GridLines monthSteps={monthSteps} />
              <div style={{ position: "relative", zIndex: 1 }}>
                {items.map((item) =>
                  item.kind === "section" ? (
                    <SectionSpacer
                      key={item.section.key}
                      section={item.section}
                      isCollapsed={item.isCollapsed}
                      windowStart={windowStart}
                      scale={effectivePxPerDay}
                    />
                  ) : (
                    <BarCell
                      key={item.row.id}
                      row={item.row}
                      windowStart={windowStart}
                      scale={effectivePxPerDay}
                      isHovered={hoveredRowId === item.row.id}
                      onHover={setHoveredRowId}
                      onBarClick={onBarClick}
                      onBarMouseEnter={handleBarMouseEnter}
                      onBarMouseMove={handleBarMouseMove}
                      onBarMouseLeave={handleBarMouseLeave}
                    />
                  )
                )}
              </div>
              {showTodayLine && <TodayOverlay todayLeftPx={todayLeftPx} />}
            </div>
          </div>
        </div>
      </div>

      {/* Hover card — rendered outside any scroll container */}
      {renderHoverCard && hoverCard &&
        renderHoverCard(hoverCard.barId, hoverCard.x, hoverCard.y)}
    </>
  );
}
