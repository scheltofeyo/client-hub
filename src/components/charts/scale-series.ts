/**
 * Shared shape and geometry for ordered-scale (Likert) charts.
 *
 * Every value-assessment row and every plain scale question is the same thing:
 * a handful of respondents each picking one point on a bounded ordinal scale.
 * Three charts render that — dots, a diverging bar, a mean/spread plot — and
 * they must agree on where a score sits horizontally, or switching views would
 * appear to move the data.
 */

/** One item on the scale — a cultural value, or the question itself. */
export interface ScaleSeries {
  id: string;
  label: string;
  /** Identity colour (e.g. the cultural value's own colour). Falls back to --primary. */
  color?: string;
  n: number;
  mean: number | null;
  sd: number | null;
  /** Counts per scale point, index 0 = `min`. */
  distribution: number[];
}

export interface ScaleBounds {
  min: number;
  max: number;
}

export function bucketCount({ min, max }: ScaleBounds): number {
  return Math.max(1, Math.round(max) - Math.round(min) + 1);
}

/**
 * Horizontal position (0–100) of a score on the plot. Buckets are columns, so a
 * whole score sits at its column centre and a mean lands proportionally between
 * two centres — which is why this takes a continuous value, not an index.
 */
export function scorePct(score: number, bounds: ScaleBounds): number {
  const n = bucketCount(bounds);
  return ((score - bounds.min + 0.5) / n) * 100;
}

/** Half a column's width, as a percentage — the padding the axis needs at both ends. */
export function halfColumnPct(bounds: ScaleBounds): number {
  return 50 / bucketCount(bounds);
}

export function scalePoints(bounds: ScaleBounds): number[] {
  return Array.from({ length: bucketCount(bounds) }, (_, i) => Math.round(bounds.min) + i);
}

export function totalResponses(distribution: number[]): number {
  return distribution.reduce((sum, c) => sum + c, 0);
}

/** Tallest column across every series — the row height all rows must share. */
export function maxStack(series: ScaleSeries[]): number {
  return Math.max(0, ...series.flatMap((s) => s.distribution));
}

/**
 * The five validated steps of the ordered-scale ramp, interpolated to any
 * bucket count.
 *
 * A 1–5 scale lands exactly on the tokens; a 1–7 scale gets `color-mix` points
 * between them rather than a repeated colour, which would make two adjacent
 * answers indistinguishable.
 */
const SCALE_STOPS = [
  "var(--scale-1)",
  "var(--scale-2)",
  "var(--scale-3)",
  "var(--scale-4)",
  "var(--scale-5)",
] as const;

export function scaleRampColors(buckets: number): string[] {
  if (buckets <= 1) return [SCALE_STOPS[2]];
  return Array.from({ length: buckets }, (_, i) => {
    const t = (i / (buckets - 1)) * (SCALE_STOPS.length - 1);
    const lower = Math.floor(t);
    const frac = t - lower;
    if (frac < 0.001) return SCALE_STOPS[lower];
    const upper = Math.min(SCALE_STOPS.length - 1, lower + 1);
    const pct = Math.round((1 - frac) * 100);
    return `color-mix(in oklab, ${SCALE_STOPS[lower]} ${pct}%, ${SCALE_STOPS[upper]})`;
  });
}

/**
 * Lowest and highest score anyone actually gave, or null when nobody answered.
 *
 * Deliberately the observed range and not mean ± 1 SD: at these group sizes an
 * SD interval leaves individual answers sitting outside it, which on a chart of
 * a dozen dots reads as a drawing error rather than as statistics. The range is
 * the one span every dot is inside by construction. The SD stays in the numeric
 * readout, where it cannot be misread as a region.
 */
export function observedRange(distribution: number[], min: number): [number, number] | null {
  const first = distribution.findIndex((c) => c > 0);
  if (first === -1) return null;
  let last = first;
  distribution.forEach((c, i) => {
    if (c > 0) last = i;
  });
  return [min + first, min + last];
}

/** A colour at `alpha` over the chart surface, for bands and soft fills. */
export function softFill(color: string, alpha: number): string {
  return `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/** Locale-aware number for the readouts. Dutch decimal comma, at most one place. */
export function fmtScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}
