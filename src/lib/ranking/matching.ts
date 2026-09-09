/**
 * Ranking the Values — matching algorithm
 *
 * Pairs participants with the most opposing value rankings using Spearman's d²
 * distance metric, maximising the total opposition across every pair at once.
 *
 * Every function here is a pure function of its input array, and the *order* of
 * that array is part of the input: ties are broken by index. Callers must hand
 * in a canonically ordered list — `match-session.ts` sorts by submission id —
 * or two callers reading the same session will disagree about who pairs with
 * whom. That was a real bug, not a hypothetical one.
 *
 * Originally ported from summ-tools/src/tools/ranking-the-values/utils/matching.js
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
 *
 * Throws when the two rankings do not cover the same values. This used to
 * default a missing value to position 0, which turned a mismatched submission
 * into a plausible-looking but wrong opposition score — the worst way to fail.
 * Callers validate first: `collectRankings()` in `match-session.ts`.
 */
export function calculateSquaredDistance(ranking1: string[], ranking2: string[]): number {
  const positionMap = new Map<string, number>();
  ranking2.forEach((valueId, index) => positionMap.set(valueId, index));

  let distance = 0;
  ranking1.forEach((valueId, index) => {
    const other = positionMap.get(valueId);
    if (other === undefined) {
      throw new Error(`Cannot compare rankings: "${valueId}" appears in one but not the other`);
    }
    const diff = index - other;
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
 * Largest group we solve exactly. The search is O(2^size · size) over an
 * even-sized set, so 18 costs ~5M operations and 2 MB — a few milliseconds,
 * and comfortably above any workshop that fits in one room.
 */
const EXACT_MATCHING_LIMIT = 18;

/** Order pairs strongest-opposition first, breaking ties on id so it is reproducible. */
function sortPairs(pairs: MatchPair[]): MatchPair[] {
  return pairs.sort(
    (a, b) =>
      b.distance - a.distance ||
      a.participant1.id.localeCompare(b.participant1.id)
  );
}

/**
 * The entry point: exact where that is affordable, heuristic beyond it.
 */
export function findPairs(submissions: Submission[]): MatchResult {
  if (submissions.length < 2) {
    return { pairs: [], unmatched: submissions[0] || null };
  }
  const padded = submissions.length + (submissions.length % 2);
  return padded <= EXACT_MATCHING_LIMIT
    ? findOptimalPairs(submissions)
    : findBalancedPairs(submissions);
}

/**
 * Maximum-weight perfect matching, solved exactly by dynamic programming over
 * subsets. `best[mask]` is the highest total opposition obtainable by pairing
 * up exactly the people in `mask`; each step pairs the lowest-numbered person
 * still in the mask with each of the others in turn. Because that first person
 * is determined by the mask alone, `choice[mask]` records an unambiguous
 * partner and the matching can be walked back out at the end.
 *
 * An odd group is padded with a dummy participant who opposes everyone by 0.
 * Whoever the dummy ends up "paired" with is the person left over — chosen so
 * that the remaining pairs are as strong as possible, rather than by guessing
 * in advance who is least matchable.
 *
 * This replaces a 2-opt hill climb that settled below the true optimum in
 * roughly a fifth of sessions, and whose result depended on the input order.
 */
export function findOptimalPairs(submissions: Submission[]): MatchResult {
  const n = submissions.length;
  if (n < 2) return { pairs: [], unmatched: submissions[0] || null };

  const dist = buildDistanceMatrix(submissions);
  const size = n + (n % 2);
  const dummy = size > n ? n : -1;
  const weightOf = (a: number, b: number) => (a === dummy || b === dummy ? 0 : dist[a][b]);

  const full = (1 << size) - 1;
  const best = new Float64Array(full + 1);
  const choice = new Int8Array(full + 1).fill(-1);

  for (let mask = 1; mask <= full; mask++) {
    // Only even-sized groups can be paired up completely.
    let count = 0;
    for (let i = 0; i < size; i++) count += (mask >> i) & 1;
    if (count % 2 !== 0) continue;

    let first = 0;
    while (!((mask >> first) & 1)) first++;

    let topTotal = -1;
    let topPartner = -1;
    for (let other = first + 1; other < size; other++) {
      if (!((mask >> other) & 1)) continue;
      const rest = mask ^ (1 << first) ^ (1 << other);
      const total = best[rest] + weightOf(first, other);
      // Strict `>` keeps the lowest-numbered partner on a tie, so equally good
      // matchings always resolve the same way.
      if (total > topTotal) {
        topTotal = total;
        topPartner = other;
      }
    }

    if (topPartner >= 0) {
      best[mask] = topTotal;
      choice[mask] = topPartner;
    }
  }

  const pairs: MatchPair[] = [];
  let unmatched: Submission | null = null;

  for (let mask = full; mask > 0; ) {
    let first = 0;
    while (!((mask >> first) & 1)) first++;
    const other = choice[mask];
    if (other < 0) break;

    if (first === dummy) unmatched = submissions[other];
    else if (other === dummy) unmatched = submissions[first];
    else {
      pairs.push({
        participant1: submissions[first],
        participant2: submissions[other],
        distance: dist[first][other],
      });
    }

    mask ^= (1 << first) | (1 << other);
  }

  return { pairs: sortPairs(pairs), unmatched };
}

/**
 * Fallback for groups too large to solve exactly: seed greedily, then 2-opt
 * local search until no single partner swap improves the total.
 *
 * Kept only for that case. It reaches a local optimum, not the best possible
 * split, and its answer depends on the order of `submissions` — which is why
 * callers must pass a canonically ordered array.
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

  const pairs = pairsList.map(([a, b]) => ({
    participant1: submissions[active[a]],
    participant2: submissions[active[b]],
    distance: dist[active[a]][active[b]],
  }));

  return {
    pairs: sortPairs(pairs),
    unmatched: unmatchedIdx !== null ? submissions[unmatchedIdx] : null,
  };
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
