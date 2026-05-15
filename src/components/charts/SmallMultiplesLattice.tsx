"use client";

import { useChartContext } from "./ChartContext";
import { CHART_TOKENS, colorForCategory } from "./ChartTheme";

export interface LatticeSide {
  id: string;
  label: string;
  /** keyId → value (already aligned across sides). */
  values: Record<string, number>;
}

export interface LatticeKey {
  id: string;
  label: string;
  /** Optional swatch color (e.g. archetype.color). Falls back to a hashed
   * accent if omitted. */
  color?: string;
}

interface SmallMultiplesLatticeProps {
  sides: LatticeSide[];
  keys: LatticeKey[];
  /** Domain max shared across all panels — keeps comparisons honest. */
  domainMax?: number;
  unitSuffix?: string;
}

/**
 * Grid of mini sorted-bar charts, one per side. Shared y-domain so panels
 * are directly comparable. Bars use `colorForCategory(keyId)` so the same
 * item is the same colour across panels.
 */
export function SmallMultiplesLattice({
  sides,
  keys,
  domainMax,
  unitSuffix = "%",
}: SmallMultiplesLatticeProps) {
  useChartContext();
  const max =
    domainMax ??
    Math.max(1, ...sides.flatMap((s) => keys.map((k) => s.values[k.id] ?? 0)));

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sides.map((side) => (
        <div
          key={side.id}
          className="rounded-card border p-3"
          style={{ borderColor: CHART_TOKENS.gridline, background: CHART_TOKENS.surface }}
        >
          <p
            className="typo-section-header mb-2"
            style={{ color: CHART_TOKENS.textMuted }}
          >
            {side.label || side.id}
          </p>
          <ul className="space-y-1">
            {keys.map((k) => {
              const v = side.values[k.id] ?? 0;
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <li
                  key={k.id}
                  className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-[11px]"
                >
                  <span className="truncate" style={{ color: CHART_TOKENS.textPrimary }}>
                    {k.label}
                  </span>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--bg-elevated)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: k.color ?? colorForCategory(k.id) }}
                    />
                  </div>
                  <span
                    className="text-right tabular-nums"
                    style={{ color: CHART_TOKENS.textMuted }}
                  >
                    {formatValue(v, unitSuffix)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: number, unit: string): string {
  if (unit === "%") return `${Math.round(v)}%`;
  return `${formatNumber(v)}${unit}`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
