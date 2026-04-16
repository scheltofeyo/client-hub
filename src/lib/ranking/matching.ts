/**
 * Ranking the Values — matching algorithm
 *
 * Pairs participants with the most opposing value rankings using
 * Spearman's d² distance metric and a balanced 2-opt local search.
 *
 * Ported from summ-tools/src/tools/ranking-the-values/utils/matching.js
 */

export interface Submission {
  id: string;
  participantName: string;
  participantEmail: string;
  rankings: string[];
}

export interface MatchPair {
  participant1: Submission;
  participant2: Submission;
  distance: number;
}

export interface MatchResult {
  pairs: MatchPair[];
  unmatched: Submission | null;
}

/**
 * Sum of squared position differences between two rankings.
 * Each ranking is an ordered array of value IDs (highest to lowest).
 *
 * Using d² (Spearman) instead of |d| (footrule) gives a more
 * nuanced opposition score — large position swaps weigh heavier,
 * so only a true reversal reaches 100%.
 */
export function calculateSquaredDistance(ranking1: string[], ranking2: string[]): number {
  const positionMap = new Map<string, number>();
  ranking2.forEach((valueId, index) => positionMap.set(valueId, index));

  let distance = 0;
  ranking1.forEach((valueId, index) => {
    const diff = index - (positionMap.get(valueId) ?? 0);
    distance += diff * diff;
  });
  return distance;
}

/**
 * Normalize squared distance to a 0-100 "opposition percentage"
 * using Spearman's rank correlation coefficient.
 *
 * ρ = 1 − 6D / (n(n²−1))
 * opposition% = (1 − ρ) / 2 × 100 = 3D / (n(n²−1)) × 100
 *
 * Only a perfect reversal yields 100%.
 */
export function normalizeDistance(squaredDistance: number, numValues: number): number {
  const n = numValues;
  if (n <= 1) return 0;
  return Math.round((3 * squaredDistance) / (n * (n * n - 1)) * 100);
}

/** Pre-compute symmetric distance matrix for all submissions. */
function buildDistanceMatrix(submissions: Submission[]): number[][] {
  const n = submissions.length;
  const dist = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = calculateSquaredDistance(submissions[i].rankings, submissions[j].rankings);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }
  return dist;
}

/**
 * Greedy matching: picks the highest-distance pair first, then the next, etc.
 * Fast but can leave "leftover" people with poor matches.
 */
export function findGreedyPairs(submissions: Submission[]): MatchResult {
  if (submissions.length < 2) {
    return { pairs: [], unmatched: submissions[0] || null };
  }

  const n = submissions.length;
  const dist = buildDistanceMatrix(submissions);

  const allPairs: { i: number; j: number; distance: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allPairs.push({ i, j, distance: dist[i][j] });
    }
  }
  allPairs.sort((a, b) => b.distance - a.distance);

  const matched = new Set<number>();
  const pairs: MatchPair[] = [];

  for (const { i, j, distance } of allPairs) {
    if (matched.has(i) || matched.has(j)) continue;
    pairs.push({ participant1: submissions[i], participant2: submissions[j], distance });
    matched.add(i);
    matched.add(j);
  }

  let unmatched: Submission | null = null;
  for (let i = 0; i < n; i++) {
    if (!matched.has(i)) { unmatched = submissions[i]; break; }
  }

  return { pairs, unmatched };
}

/**
 * Balanced matching: starts greedy, then uses 2-opt local search to
 * swap partners until total opposition across ALL pairs is maximized.
 * Produces a fairer spread of scores — no 5% leftovers.
 */
export function findBalancedPairs(submissions: Submission[]): MatchResult {
  if (submissions.length < 2) {
    return { pairs: [], unmatched: submissions[0] || null };
  }

  const n = submissions.length;
  const dist = buildDistanceMatrix(submissions);

  // For odd count: remove the person with the lowest total distance (least matchable)
  let unmatchedIdx: number | null = null;
  let active = Array.from({ length: n }, (_, i) => i);

  if (n % 2 !== 0) {
    let minTotal = Infinity;
    for (let i = 0; i < n; i++) {
      let total = 0;
      for (let j = 0; j < n; j++) total += dist[i][j];
      if (total < minTotal) { minTotal = total; unmatchedIdx = i; }
    }
    active = active.filter((i) => i !== unmatchedIdx);
  }

  // Greedy seed
  const pairDists: { a: number; b: number; d: number }[] = [];
  for (let a = 0; a < active.length; a++) {
    for (let b = a + 1; b < active.length; b++) {
      pairDists.push({ a, b, d: dist[active[a]][active[b]] });
    }
  }
  pairDists.sort((a, b) => b.d - a.d);

  const matched = new Set<number>();
  const pairsList: [number, number][] = [];
  for (const { a, b } of pairDists) {
    if (matched.has(a) || matched.has(b)) continue;
    pairsList.push([a, b]);
    matched.add(a);
    matched.add(b);
  }

  // 2-opt: try swapping partners between every pair combination
  let improved = true;
  while (improved) {
    improved = false;
    for (let p = 0; p < pairsList.length; p++) {
      for (let q = p + 1; q < pairsList.length; q++) {
        const [a, b] = pairsList[p];
        const [c, d] = pairsList[q];
        const current = dist[active[a]][active[b]] + dist[active[c]][active[d]];
        const swap1 = dist[active[a]][active[c]] + dist[active[b]][active[d]];
        const swap2 = dist[active[a]][active[d]] + dist[active[b]][active[c]];

        if (swap1 > current && swap1 >= swap2) {
          pairsList[p] = [a, c]; pairsList[q] = [b, d]; improved = true;
        } else if (swap2 > current) {
          pairsList[p] = [a, d]; pairsList[q] = [b, c]; improved = true;
        }
      }
    }
  }

  const pairs = pairsList
    .map(([a, b]) => ({
      participant1: submissions[active[a]],
      participant2: submissions[active[b]],
      distance: dist[active[a]][active[b]],
    }))
    .sort((a, b) => b.distance - a.distance);

  return { pairs, unmatched: unmatchedIdx !== null ? submissions[unmatchedIdx] : null };
}

/**
 * Given an unmatched participant and the list of formed pairs,
 * find the duo whose members have the highest combined opposition
 * with the unmatched person — the best group to join for discussion.
 */
export function findBestDuoForUnmatched(
  unmatched: Submission,
  pairs: MatchPair[],
  numValues: number
): { pair: MatchPair; avgOpposition: number } | null {
  if (pairs.length === 0) return null;

  let bestPair: MatchPair | null = null;
  let bestAvg = -1;

  for (const pair of pairs) {
    const d1 = calculateSquaredDistance(unmatched.rankings, pair.participant1.rankings);
    const d2 = calculateSquaredDistance(unmatched.rankings, pair.participant2.rankings);
    const avg = (normalizeDistance(d1, numValues) + normalizeDistance(d2, numValues)) / 2;

    if (avg > bestAvg) {
      bestAvg = avg;
      bestPair = pair;
    }
  }

  return bestPair ? { pair: bestPair, avgOpposition: Math.round(bestAvg) } : null;
}
