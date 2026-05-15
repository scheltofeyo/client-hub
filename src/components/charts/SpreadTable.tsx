"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useChartContext } from "./ChartContext";
import { CHART_TOKENS } from "./ChartTheme";

export interface SpreadTableSide {
  id: string;
  label: string;
  values: Record<string, number>;
}

export interface SpreadTableRow {
  id: string;
  label: string;
}

interface SpreadTableProps {
  rows: SpreadTableRow[];
  sides: SpreadTableSide[];
  unitSuffix?: string;
  /** Pre-computed spread (max − min) per row id. Used as the headline column. */
  spread: Record<string, number>;
}

type SortKey =
  | { kind: "row" }
  | { kind: "spread" }
  | { kind: "side"; sideId: string };

/**
 * Sortable table: row label, one column per side, headline range column.
 * Range column shows a mini-bar in primary-light + numeric value.
 */
export function SpreadTable({ rows, sides, unitSuffix = "%", spread }: SpreadTableProps) {
  useChartContext();
  const [sortKey, setSortKey] = useState<SortKey>({ kind: "spread" });
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const maxSpread = useMemo(() => Math.max(0, ...Object.values(spread)), [spread]);

  const sorted = useMemo(() => {
    const valueFor = (row: SpreadTableRow): number => {
      if (sortKey.kind === "row") return row.label.charCodeAt(0) || 0;
      if (sortKey.kind === "spread") return spread[row.id] ?? 0;
      const side = sides.find((s) => s.id === sortKey.sideId);
      return side?.values[row.id] ?? 0;
    };
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = valueFor(a);
      const vb = valueFor(b);
      if (sortKey.kind === "row") {
        const cmp = a.label.localeCompare(b.label);
        return direction === "asc" ? cmp : -cmp;
      }
      return direction === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [rows, sides, spread, sortKey, direction]);

  function clickHeader(next: SortKey) {
    if (sameKey(sortKey, next)) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(next);
      setDirection("desc");
    }
  }

  return (
    <div className="overflow-auto rounded-card border" style={{ borderColor: CHART_TOKENS.gridline }}>
      <table className="w-full text-xs">
        <thead style={{ background: "var(--bg-elevated)" }}>
          <tr>
            <HeaderCell
              align="left"
              active={sortKey.kind === "row"}
              direction={direction}
              onClick={() => clickHeader({ kind: "row" })}
            >
              Item
            </HeaderCell>
            {sides.map((s) => (
              <HeaderCell
                key={s.id}
                align="right"
                active={sortKey.kind === "side" && sortKey.sideId === s.id}
                direction={direction}
                onClick={() => clickHeader({ kind: "side", sideId: s.id })}
              >
                {s.label || s.id}
              </HeaderCell>
            ))}
            <HeaderCell
              align="right"
              active={sortKey.kind === "spread"}
              direction={direction}
              onClick={() => clickHeader({ kind: "spread" })}
            >
              Range
            </HeaderCell>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const r = spread[row.id] ?? 0;
            const pct = maxSpread > 0 ? (r / maxSpread) * 100 : 0;
            return (
              <tr key={row.id} className="border-t" style={{ borderColor: CHART_TOKENS.gridline }}>
                <td className="px-3 py-1.5 truncate max-w-[14rem]" style={{ color: CHART_TOKENS.textPrimary }}>
                  {row.label}
                </td>
                {sides.map((s) => (
                  <td
                    key={s.id}
                    className="text-right px-3 py-1.5 tabular-nums"
                    style={{ color: CHART_TOKENS.textPrimary }}
                  >
                    {formatValue(s.values[row.id] ?? 0, unitSuffix)}
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--bg-elevated)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: CHART_TOKENS.primaryLight }}
                      />
                    </div>
                    <span className="tabular-nums font-semibold" style={{ color: CHART_TOKENS.textPrimary }}>
                      {formatValue(r, unitSuffix)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({
  children,
  align,
  active,
  direction,
  onClick,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`} style={{ color: CHART_TOKENS.textMuted }}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} hover:text-text-primary transition-colors`}
      >
        {children}
        {active ? (
          direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <ChevronsUpDown size={11} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

function sameKey(a: SortKey, b: SortKey): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "side" && b.kind === "side") return a.sideId === b.sideId;
  return true;
}

function formatValue(v: number, unit: string): string {
  if (unit === "%") return `${Math.round(v)}%`;
  return `${formatNumber(v)}${unit}`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
