/**
 * Dispersion for ordinal (Likert) answers.
 *
 * Deliberately separate from `agreement.ts`, which measures Shannon entropy over
 * an unordered set of buckets. Entropy cannot tell "half the group answered 1 and
 * half answered 5" apart from "everyone answered 3 or 4" — the two distributions
 * have the same shape once you forget that 5 is further from 1 than from 4. For a
 * self-assessment that distinction is the entire point of looking at spread, so
 * the ordinal types use the standard deviation instead.
 */

export interface ScaleStats {
  n: number;
  mean: number;
  /** Population standard deviation. Null when n < 2, where spread is undefined. */
  sd: number | null;
  /** Counts per scale point, index 0 = `min`. */
  distribution: number[];
  min: number;
  max: number;
}

export function computeScaleStats(
  values: number[],
  bounds: { min: number; max: number }
): ScaleStats | null {
  const min = Math.round(bounds.min);
  const max = Math.round(bounds.max);
  const bucketCount = Math.max(0, max - min + 1);
  if (bucketCount === 0) return null;

  const distribution = Array<number>(bucketCount).fill(0);
  const clean: number[] = [];
  for (const raw of values) {
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const rounded = Math.round(v);
    if (rounded < min || rounded > max) continue;
    clean.push(rounded);
    distribution[rounded - min] += 1;
  }
  if (clean.length === 0) return null;

  const n = clean.length;
  const mean = clean.reduce((sum, v) => sum + v, 0) / n;
  // Population SD: these are all the responses there are, not a sample of a
  // larger population we are trying to infer.
  const sd =
    n < 2
      ? null
      : Math.sqrt(clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n);

  return { n, mean, sd, distribution, min, max };
}

/**
 * Mean rank position (1 = ranked first) from a rank distribution, where index 0
 * holds the count of rank 1. Returns null when nobody ranked the item.
 *
 * This is what a value-ranking reports instead of weighted points: with a weight
 * array shorter than the number of items, every position past its length would
 * score zero and quietly flatten the tail of the ranking.
 */
export function meanRankFromDistribution(distribution: number[]): number | null {
  let total = 0;
  let weighted = 0;
  distribution.forEach((count, index) => {
    total += count;
    weighted += count * (index + 1);
  });
  if (total === 0) return null;
  return weighted / total;
}
