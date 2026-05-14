/**
 * Returns 0..1 where 1 = unanimous, 0 = perfectly uniform (max polarisation).
 * Returns null when there is no data to compute on.
 *
 * Implementation: 1 − H / log2(k), where H is Shannon entropy of the
 * distribution and k is the number of possible outcomes (buckets).
 */
export function computeAgreement(distribution: number[]): number | null {
  if (!distribution || distribution.length === 0) return null;
  const total = distribution.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return null;
  const k = distribution.length;
  if (k <= 1) return 1;

  let entropy = 0;
  for (const count of distribution) {
    if (count <= 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(k);
  if (maxEntropy <= 0) return 1;
  const agreement = 1 - entropy / maxEntropy;
  return Math.max(0, Math.min(1, agreement));
}

/**
 * Aggregate agreement over multiple distributions (e.g. per-archetype rank
 * distributions inside one ranking question, or per-section average).
 * Weighted by sample-size of each distribution.
 */
export function averageAgreement(distributions: number[][]): number | null {
  const items = distributions
    .map((dist) => ({ agreement: computeAgreement(dist), n: dist.reduce((s, v) => s + v, 0) }))
    .filter((x) => x.agreement !== null && x.n > 0) as { agreement: number; n: number }[];
  if (items.length === 0) return null;
  const totalN = items.reduce((s, x) => s + x.n, 0);
  if (totalN <= 0) return null;
  return items.reduce((s, x) => s + (x.agreement * x.n) / totalN, 0);
}
