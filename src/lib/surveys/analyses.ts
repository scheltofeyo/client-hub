import type { ISurveyAnswer } from "@/lib/models/SurveySubmission";
import type { SurveyQuestionType } from "./types";
import { TOP3_RANK_LENGTH } from "./types";
import type { QuestionMeta, SubmissionLike, SurveyAccumulators } from "./distributions";

// ─── Types ─────────────────────────────────────────────────────────────

export type AnalysisType = "summary" | "comparison";

export type AnalysisOperation =
  | "mc-average"
  | "mc-pooled"
  | "archetype-points"
  | "ranking-mean"
  | "open-text-frequency"
  | "delta-2"
  | "side-by-side-n"
  | "top-k-overlap"
  | "paired-delta"
  | "convergence";

export interface AnalysisSide {
  id: string;
  label: string;
  questionIds: string[];
}

export interface AnalysisConfig {
  id: string;
  rank: number;
  title: string;
  type: AnalysisType;
  operation: AnalysisOperation;
  sides: AnalysisSide[];
  chartKey?: string;
  capabilityFingerprint?: string;
}

export interface AnalysisKeyMeta {
  id: string;
  label: string;
  /** Optional swatch colour (e.g. archetype.color). Charts may fall back to a
   * deterministic hash when omitted. */
  color?: string;
}

export interface AnalysisSideResult {
  id: string;
  label: string;
  n: number;
  questionIds: string[];
  values: { keyId: string; value: number }[];
  /** Per-key rank-position counts summed across the side's questions.
   * Only populated for rank-based summary operations (archetype-points,
   * ranking-mean). Index 0 = rank 1. */
  distributions?: { keyId: string; counts: number[] }[];
}

export interface AnalysisResult {
  id: string;
  title: string;
  type: AnalysisType;
  operation: AnalysisOperation;
  chartKey?: string;
  n: number;
  lowConfidence: boolean;
  compatibilityBroken: boolean;
  keys: AnalysisKeyMeta[];
  sides: AnalysisSideResult[];
  /** delta-2: per-key (left − right). side-by-side-n: per-key (max − min). */
  derived?: { keyId: string; value: number }[];
  /** top-k-overlap: Jaccard scalar 0..1. paired-delta: mean delta magnitude. */
  scalar?: number;
  /** Open-text concat list (open-text-frequency only). */
  rawTexts?: { text: string }[];
  /** Source unit per key for UI labels: "%", "pts", "rank", "count". */
  unit?: "percent" | "points" | "rank" | "count";
}

export interface AnalysisComputeContext {
  questionMetas: QuestionMeta[];
  archetypes: { id: string; name: string; color: string }[];
  acc: SurveyAccumulators;
  submissions: SubmissionLike[];
  rankWeights: number[];
  top3Weights: number[];
  lowConfidenceThreshold: number;
}

// ─── Operation metadata ────────────────────────────────────────────────

export const SUMMARY_OPERATIONS: AnalysisOperation[] = [
  "mc-average",
  "mc-pooled",
  "archetype-points",
  "ranking-mean",
  "open-text-frequency",
];

export const COMPARISON_OPERATIONS: AnalysisOperation[] = [
  "delta-2",
  "side-by-side-n",
  "top-k-overlap",
  "paired-delta",
  "convergence",
];

export const OP_QUESTION_TYPES: Record<AnalysisOperation, SurveyQuestionType[]> = {
  "mc-average": ["multiple-choice"],
  "mc-pooled": ["multiple-choice"],
  "archetype-points": ["archetype-ranking", "archetype-top3"],
  "ranking-mean": ["general-ranking", "general-top3"],
  "open-text-frequency": ["open-text"],
  "delta-2": ["multiple-choice", "archetype-ranking", "archetype-top3", "general-ranking", "general-top3"],
  "side-by-side-n": ["multiple-choice", "archetype-ranking", "archetype-top3", "general-ranking", "general-top3"],
  "top-k-overlap": ["archetype-ranking", "archetype-top3", "general-ranking", "general-top3"],
  "paired-delta": ["multiple-choice", "archetype-ranking", "archetype-top3", "general-ranking", "general-top3"],
  "convergence": ["multiple-choice", "archetype-ranking", "archetype-top3", "general-ranking", "general-top3"],
};

export const OP_LABEL: Record<AnalysisOperation, string> = {
  "mc-average": "Average %",
  "mc-pooled": "Pooled %",
  "archetype-points": "Archetype points",
  "ranking-mean": "Mean rank",
  "open-text-frequency": "Term frequency",
  "delta-2": "Delta (2 sides)",
  "side-by-side-n": "Side-by-side (N)",
  "top-k-overlap": "Top-K overlap",
  "paired-delta": "Paired delta",
  "convergence": "Convergence",
};

export const TOP_K_DEFAULT = 3;

// ─── Schema fingerprint + compatibility ────────────────────────────────

export function questionSchemaKey(q: QuestionMeta): string {
  switch (q.type) {
    case "multiple-choice":
      return JSON.stringify({
        t: "mc",
        c: [...(q.choices ?? []).map((c) => c.id)].sort(),
        m: q.choiceMode ?? "single",
        max: q.maxSelections ?? null,
      });
    case "archetype-ranking":
      return JSON.stringify({
        t: "ar",
        a: [...new Set((q.options ?? []).map((o) => o.archetypeId))].sort(),
      });
    case "archetype-top3":
      return JSON.stringify({
        t: "ar3",
        a: [...new Set((q.options ?? []).map((o) => o.archetypeId))].sort(),
      });
    case "general-ranking":
      return JSON.stringify({
        t: "gr",
        i: [...(q.rankingItems ?? []).map((i) => i.id)].sort(),
        len: (q.rankingItems ?? []).length,
      });
    case "general-top3":
      return JSON.stringify({
        t: "gr3",
        i: [...(q.rankingItems ?? []).map((i) => i.id)].sort(),
        len: (q.rankingItems ?? []).length,
      });
    case "open-text":
      return "open-text";
    default:
      return "intro";
  }
}

export function computeCapabilityFingerprint(
  questionIds: string[],
  questionMetas: QuestionMeta[]
): string {
  const map = new Map(questionMetas.map((q) => [q.id, q]));
  const parts = questionIds
    .map((id) => {
      const q = map.get(id);
      return q ? `${id}:${questionSchemaKey(q)}` : `${id}:missing`;
    })
    .sort();
  return fnv1a(parts.join("|"));
}

// FNV-1a 32-bit. Deterministic, no deps — chosen over JSON.stringify-of-sort
// because the fingerprint ends up in URLs and DB diffs.
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export interface CompatibilityResult {
  id: string;
  compatible: boolean;
  reason?: string;
}

export function compatibleQuestionsFor(
  operation: AnalysisOperation,
  baselineQuestion: QuestionMeta | null,
  allQuestions: QuestionMeta[]
): CompatibilityResult[] {
  const allowedTypes = OP_QUESTION_TYPES[operation];
  const baselineSchema = baselineQuestion ? questionSchemaKey(baselineQuestion) : null;
  const opLabel = OP_LABEL[operation];
  return allQuestions
    .filter((q) => q.type !== "intro")
    .map((q) => {
      if (!allowedTypes.includes(q.type)) {
        return { id: q.id, compatible: false, reason: `not compatible with ${opLabel}` };
      }
      if (baselineSchema !== null && questionSchemaKey(q) !== baselineSchema) {
        return { id: q.id, compatible: false, reason: "different answer options" };
      }
      return { id: q.id, compatible: true };
    });
}

// ─── Per-question distribution ────────────────────────────────────────

interface QuestionDistribution {
  keys: AnalysisKeyMeta[];
  values: Record<string, number>;
  n: number;
}

function distributionForQuestion(
  qm: QuestionMeta,
  ctx: AnalysisComputeContext
): QuestionDistribution {
  const { acc, archetypes } = ctx;
  const n = acc.questionN.get(qm.id) ?? 0;
  if (qm.type === "multiple-choice") {
    const counts = acc.choiceCountMap.get(qm.id);
    const choices = qm.choices ?? [];
    const keys: AnalysisKeyMeta[] = choices.map((c) => ({ id: c.id, label: c.text || "(no text)" }));
    const values: Record<string, number> = {};
    for (const c of choices) {
      const count = counts?.get(c.id) ?? 0;
      values[c.id] = n > 0 ? (count / n) * 100 : 0;
    }
    return { keys, values, n };
  }
  if (qm.type === "archetype-ranking" || qm.type === "archetype-top3") {
    // Normalize per-question so each archetype's value is its share (%) of
    // the question's total ranking points. Side aggregation then averages
    // those % shares — preventing a question with more respondents from
    // out-weighting a quieter one in the same side.
    const points = acc.scoreMap.get(qm.id) ?? new Map<string, number>();
    const total = [...points.values()].reduce((s, v) => s + v, 0);
    const keys: AnalysisKeyMeta[] = archetypes.map((a) => ({ id: a.id, label: a.name, color: a.color }));
    const values: Record<string, number> = {};
    for (const a of archetypes) {
      const v = points.get(a.id) ?? 0;
      values[a.id] = total > 0 ? (v / total) * 100 : 0;
    }
    return { keys, values, n };
  }
  if (qm.type === "general-ranking" || qm.type === "general-top3") {
    const items = qm.rankingItems ?? [];
    const isTop3 = qm.type === "general-top3";
    const distLen = isTop3 ? TOP3_RANK_LENGTH : items.length;
    const itemDist = acc.rankItemDistMap.get(qm.id);
    const keys: AnalysisKeyMeta[] = items.map((i) => ({ id: i.id, label: i.text || "(no text)" }));
    const values: Record<string, number> = {};
    // Mean-rank metric: for top-3, unranked items implicitly sit at rank
    // (TOP3_RANK_LENGTH + 1) so they don't disappear from the chart and
    // still compare meaningfully against ranked items.
    const unrankedRank = isTop3 ? TOP3_RANK_LENGTH + 1 : undefined;
    for (const item of items) {
      const dist = itemDist?.get(item.id) ?? Array(distLen).fill(0);
      const totalAnswers = dist.reduce((s, v) => s + v, 0);
      const weightedSum = dist.reduce((s, c, idx) => s + c * (idx + 1), 0);
      if (isTop3) {
        const unranked = Math.max(0, n - totalAnswers);
        const num = weightedSum + unranked * (unrankedRank ?? 0);
        const denom = totalAnswers + unranked;
        values[item.id] = denom > 0 ? num / denom : 0;
      } else {
        values[item.id] = totalAnswers > 0 ? weightedSum / totalAnswers : 0;
      }
    }
    return { keys, values, n };
  }
  if (qm.type === "open-text") {
    return { keys: [], values: {}, n };
  }
  return { keys: [], values: {}, n: 0 };
}

// Choose a canonical key set + label map by walking the questions in a side.
// All questions in a side are required to share schema at save time, so any
// question's key set is authoritative; we pick the first non-empty one.
function keyMetaFor(questionIds: string[], ctx: AnalysisComputeContext): AnalysisKeyMeta[] {
  const metaMap = new Map(ctx.questionMetas.map((q) => [q.id, q]));
  for (const qid of questionIds) {
    const qm = metaMap.get(qid);
    if (!qm) continue;
    const dist = distributionForQuestion(qm, ctx);
    if (dist.keys.length > 0) return dist.keys;
  }
  return [];
}

// ─── Side aggregation per operation ────────────────────────────────────

interface SideAggregate {
  values: Record<string, number>;
  n: number;
}

function aggregateSide(
  side: AnalysisSide,
  operation: AnalysisOperation,
  ctx: AnalysisComputeContext
): SideAggregate {
  const metaMap = new Map(ctx.questionMetas.map((q) => [q.id, q]));
  const qms = side.questionIds.map((id) => metaMap.get(id)).filter((q): q is QuestionMeta => !!q);

  switch (operation) {
    case "mc-average":
    case "ranking-mean":
    case "side-by-side-n":
    case "convergence":
    case "top-k-overlap":
    case "paired-delta":
    case "delta-2": {
      // Equal-weight average of per-question distributions.
      // Skips questions with n=0 so they don't drag the average to zero.
      const sumByKey = new Map<string, number>();
      const countByKey = new Map<string, number>();
      let maxN = 0;
      for (const qm of qms) {
        const dist = distributionForQuestion(qm, ctx);
        if (dist.n === 0) continue;
        maxN = Math.max(maxN, dist.n);
        for (const [keyId, v] of Object.entries(dist.values)) {
          sumByKey.set(keyId, (sumByKey.get(keyId) ?? 0) + v);
          countByKey.set(keyId, (countByKey.get(keyId) ?? 0) + 1);
        }
      }
      const values: Record<string, number> = {};
      for (const [keyId, sum] of sumByKey.entries()) {
        const cnt = countByKey.get(keyId) ?? 1;
        values[keyId] = sum / cnt;
      }
      return { values, n: maxN };
    }
    case "mc-pooled": {
      // Pool counts and respondents across all questions in the side.
      const totalCount = new Map<string, number>();
      let totalN = 0;
      for (const qm of qms) {
        if (qm.type !== "multiple-choice") continue;
        const counts = ctx.acc.choiceCountMap.get(qm.id);
        const n = ctx.acc.questionN.get(qm.id) ?? 0;
        if (n === 0) continue;
        totalN += n;
        for (const c of qm.choices ?? []) {
          totalCount.set(c.id, (totalCount.get(c.id) ?? 0) + (counts?.get(c.id) ?? 0));
        }
      }
      const values: Record<string, number> = {};
      for (const [keyId, count] of totalCount.entries()) {
        values[keyId] = totalN > 0 ? (count / totalN) * 100 : 0;
      }
      return { values, n: totalN };
    }
    case "archetype-points": {
      // Sum raw points per archetype across all archetype-ranking questions in the side.
      const sums = new Map<string, number>();
      let maxN = 0;
      for (const qm of qms) {
        if (qm.type !== "archetype-ranking" && qm.type !== "archetype-top3") continue;
        const points = ctx.acc.scoreMap.get(qm.id);
        const n = ctx.acc.questionN.get(qm.id) ?? 0;
        if (n === 0 || !points) continue;
        maxN = Math.max(maxN, n);
        for (const [aid, v] of points.entries()) {
          sums.set(aid, (sums.get(aid) ?? 0) + v);
        }
      }
      const values: Record<string, number> = {};
      for (const a of ctx.archetypes) values[a.id] = sums.get(a.id) ?? 0;
      return { values, n: maxN };
    }
    case "open-text-frequency": {
      // No per-key distribution at side level — handled in computeSummary.
      let n = 0;
      for (const qm of qms) n += ctx.acc.questionN.get(qm.id) ?? 0;
      return { values: {}, n };
    }
  }
}

// ─── Summary compute ───────────────────────────────────────────────────

function computeSummary(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  const side = analysis.sides[0] ?? { id: "main", label: "", questionIds: [] };
  const lowConfidence = isLowConfidence([side.questionIds.length > 0 ? aggregateSide(side, analysis.operation, ctx).n : 0], ctx);
  const base = baseResult(analysis, lowConfidence);

  if (analysis.operation === "open-text-frequency") {
    return computeOpenTextSummary(analysis, base, ctx);
  }

  const agg = aggregateSide(side, analysis.operation, ctx);
  const keys = keyMetaFor(side.questionIds, ctx);
  const orderedKeys = keys.length > 0 ? keys : Object.keys(agg.values).map((id) => ({ id, label: id }));
  const distributions = rankDistributionsForSide(side, analysis.operation, ctx, orderedKeys);

  return {
    ...base,
    n: agg.n,
    keys: orderedKeys,
    sides: [{
      id: side.id,
      label: side.label,
      n: agg.n,
      questionIds: side.questionIds,
      values: orderedKeys.map((k) => ({ keyId: k.id, value: agg.values[k.id] ?? 0 })),
      ...(distributions ? { distributions } : {}),
    }],
    unit: unitForOperation(analysis.operation),
  };
}

/**
 * Sum per-rank-position counts across the questions in a side, so the
 * podium / heatmap / sorted-bar charts can show a meaningful distribution
 * for a multi-question summary. Returns undefined for operations where a
 * rank distribution is not meaningful.
 */
function rankDistributionsForSide(
  side: AnalysisSide,
  operation: AnalysisOperation,
  ctx: AnalysisComputeContext,
  keys: AnalysisKeyMeta[]
): { keyId: string; counts: number[] }[] | undefined {
  if (operation !== "archetype-points" && operation !== "ranking-mean") return undefined;
  const metaMap = new Map(ctx.questionMetas.map((q) => [q.id, q]));
  const summed = new Map<string, number[]>();

  for (const qid of side.questionIds) {
    const qm = metaMap.get(qid);
    if (!qm) continue;
    if (
      operation === "archetype-points" &&
      (qm.type === "archetype-ranking" || qm.type === "archetype-top3")
    ) {
      const dist = ctx.acc.rankDistMap.get(qm.id);
      if (!dist) continue;
      for (const [archetypeId, counts] of dist.entries()) {
        const acc = summed.get(archetypeId) ?? [];
        for (let i = 0; i < counts.length; i++) acc[i] = (acc[i] ?? 0) + (counts[i] ?? 0);
        summed.set(archetypeId, acc);
      }
    } else if (
      operation === "ranking-mean" &&
      (qm.type === "general-ranking" || qm.type === "general-top3")
    ) {
      const dist = ctx.acc.rankItemDistMap.get(qm.id);
      if (!dist) continue;
      for (const [itemId, counts] of dist.entries()) {
        const acc = summed.get(itemId) ?? [];
        for (let i = 0; i < counts.length; i++) acc[i] = (acc[i] ?? 0) + (counts[i] ?? 0);
        summed.set(itemId, acc);
      }
    }
  }

  if (summed.size === 0) return undefined;
  return keys.map((k) => ({ keyId: k.id, counts: summed.get(k.id) ?? [] }));
}

function computeOpenTextSummary(
  analysis: AnalysisConfig,
  base: AnalysisResult,
  ctx: AnalysisComputeContext
): AnalysisResult {
  const side = analysis.sides[0] ?? { id: "main", label: "", questionIds: [] };
  const texts: { text: string }[] = [];
  for (const qid of side.questionIds) {
    const answers = ctx.acc.openTextAnswersByQuestion.get(qid) ?? [];
    for (const a of answers) texts.push({ text: a.text });
  }
  const tokenCounts = countTokens(texts.map((t) => t.text));
  const orderedKeys: AnalysisKeyMeta[] = tokenCounts.slice(0, 50).map(([term]) => ({ id: term, label: term }));
  return {
    ...base,
    n: texts.length,
    keys: orderedKeys,
    sides: [{
      id: side.id,
      label: side.label,
      n: texts.length,
      questionIds: side.questionIds,
      values: tokenCounts.slice(0, 50).map(([term, count]) => ({ keyId: term, value: count })),
    }],
    rawTexts: texts,
    unit: "count",
  };
}

// ─── Comparison compute ────────────────────────────────────────────────

function computeComparison(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  switch (analysis.operation) {
    case "delta-2":
      return computeDelta2(analysis, ctx);
    case "side-by-side-n":
      return computeSideBySide(analysis, ctx);
    case "top-k-overlap":
      return computeTopKOverlap(analysis, ctx);
    case "paired-delta":
      return computePairedDelta(analysis, ctx);
    case "convergence":
      return computeConvergence(analysis, ctx);
    default:
      return baseResult(analysis, false);
  }
}

function computeDelta2(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  const [left, right] = [analysis.sides[0], analysis.sides[1]];
  if (!left || !right) return baseResult(analysis, false);
  const aggL = aggregateSide(left, analysis.operation, ctx);
  const aggR = aggregateSide(right, analysis.operation, ctx);
  const keys = keyMetaFor([...left.questionIds, ...right.questionIds], ctx);
  const lowConfidence = isLowConfidence([aggL.n, aggR.n], ctx);

  const sides: AnalysisSideResult[] = [
    { id: left.id, label: left.label, n: aggL.n, questionIds: left.questionIds, values: keys.map((k) => ({ keyId: k.id, value: aggL.values[k.id] ?? 0 })) },
    { id: right.id, label: right.label, n: aggR.n, questionIds: right.questionIds, values: keys.map((k) => ({ keyId: k.id, value: aggR.values[k.id] ?? 0 })) },
  ];
  const derived = keys.map((k) => ({
    keyId: k.id,
    value: (aggL.values[k.id] ?? 0) - (aggR.values[k.id] ?? 0),
  }));
  return {
    ...baseResult(analysis, lowConfidence),
    n: Math.max(aggL.n, aggR.n),
    keys,
    sides,
    derived,
    unit: unitForOperation(analysis.operation),
  };
}

function computeSideBySide(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  const aggs = analysis.sides.map((s) => ({ side: s, agg: aggregateSide(s, analysis.operation, ctx) }));
  const allQids = analysis.sides.flatMap((s) => s.questionIds);
  const keys = keyMetaFor(allQids, ctx);
  const lowConfidence = isLowConfidence(aggs.map((x) => x.agg.n), ctx);
  const sides: AnalysisSideResult[] = aggs.map(({ side, agg }) => ({
    id: side.id,
    label: side.label,
    n: agg.n,
    questionIds: side.questionIds,
    values: keys.map((k) => ({ keyId: k.id, value: agg.values[k.id] ?? 0 })),
  }));
  const derived = keys.map((k) => {
    const values = aggs.map(({ agg }) => agg.values[k.id] ?? 0);
    return { keyId: k.id, value: Math.max(...values) - Math.min(...values) };
  });
  return {
    ...baseResult(analysis, lowConfidence),
    n: Math.max(0, ...aggs.map((x) => x.agg.n)),
    keys,
    sides,
    derived,
    unit: unitForOperation(analysis.operation),
  };
}

function computeTopKOverlap(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  const k = TOP_K_DEFAULT;
  const aggs = analysis.sides.map((s) => ({ side: s, agg: aggregateSide(s, analysis.operation, ctx) }));
  const allQids = analysis.sides.flatMap((s) => s.questionIds);
  const keys = keyMetaFor(allQids, ctx);
  const lowConfidence = isLowConfidence(aggs.map((x) => x.agg.n), ctx);

  // Determine sort direction: for ranking-mean, smaller = better. For archetype-points, larger.
  // We infer from the first question's type.
  const firstMeta = ctx.questionMetas.find((q) => allQids.includes(q.id));
  const ascending = firstMeta?.type === "general-ranking" || firstMeta?.type === "general-top3";

  const topKPerSide = aggs.map(({ agg }) => {
    const entries = Object.entries(agg.values);
    entries.sort((a, b) => (ascending ? a[1] - b[1] : b[1] - a[1]));
    return new Set(entries.slice(0, k).map(([id]) => id));
  });

  let scalar: number | undefined = undefined;
  if (topKPerSide.length >= 2) {
    const intersection = new Set(topKPerSide[0]);
    for (let i = 1; i < topKPerSide.length; i++) {
      for (const x of [...intersection]) if (!topKPerSide[i].has(x)) intersection.delete(x);
    }
    const union = new Set<string>();
    for (const s of topKPerSide) for (const x of s) union.add(x);
    scalar = union.size > 0 ? intersection.size / union.size : 0;
  }

  const sides: AnalysisSideResult[] = aggs.map(({ side, agg }, idx) => ({
    id: side.id,
    label: side.label,
    n: agg.n,
    questionIds: side.questionIds,
    values: keys.map((kmeta) => ({
      keyId: kmeta.id,
      value: topKPerSide[idx].has(kmeta.id) ? 1 : 0,
    })),
  }));

  return {
    ...baseResult(analysis, lowConfidence),
    n: Math.max(0, ...aggs.map((x) => x.agg.n)),
    keys,
    sides,
    scalar,
    unit: "count",
  };
}

function computePairedDelta(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  // Within-respondent: for each submission, compute side-level distribution
  // for left and right, then average per-respondent deltas across submissions
  // that have data for both sides.
  const [left, right] = [analysis.sides[0], analysis.sides[1]];
  if (!left || !right) return baseResult(analysis, false);

  const keys = keyMetaFor([...left.questionIds, ...right.questionIds], ctx);
  const perKeySum = new Map<string, number>();
  const perKeyCount = new Map<string, number>();
  let pairedN = 0;

  for (const sub of ctx.submissions) {
    const leftDist = sideDistributionForSubmission(left.questionIds, sub, ctx);
    const rightDist = sideDistributionForSubmission(right.questionIds, sub, ctx);
    if (!leftDist || !rightDist) continue;
    pairedN += 1;
    for (const k of keys) {
      const delta = (leftDist[k.id] ?? 0) - (rightDist[k.id] ?? 0);
      perKeySum.set(k.id, (perKeySum.get(k.id) ?? 0) + delta);
      perKeyCount.set(k.id, (perKeyCount.get(k.id) ?? 0) + 1);
    }
  }

  const derived = keys.map((k) => {
    const sum = perKeySum.get(k.id) ?? 0;
    const cnt = perKeyCount.get(k.id) ?? 0;
    return { keyId: k.id, value: cnt > 0 ? sum / cnt : 0 };
  });
  const meanAbs = derived.length > 0
    ? derived.reduce((s, d) => s + Math.abs(d.value), 0) / derived.length
    : 0;

  const sides: AnalysisSideResult[] = [left, right].map((s) => {
    const agg = aggregateSide(s, analysis.operation, ctx);
    return {
      id: s.id,
      label: s.label,
      n: agg.n,
      questionIds: s.questionIds,
      values: keys.map((k) => ({ keyId: k.id, value: agg.values[k.id] ?? 0 })),
    };
  });

  return {
    ...baseResult(analysis, pairedN > 0 && pairedN < ctx.lowConfidenceThreshold),
    n: pairedN,
    keys,
    sides,
    derived,
    scalar: meanAbs,
    unit: unitForOperation(analysis.operation),
  };
}

function computeConvergence(analysis: AnalysisConfig, ctx: AnalysisComputeContext): AnalysisResult {
  const aggs = analysis.sides.map((s) => ({ side: s, agg: aggregateSide(s, analysis.operation, ctx) }));
  const allQids = analysis.sides.flatMap((s) => s.questionIds);
  const keys = keyMetaFor(allQids, ctx);
  const lowConfidence = isLowConfidence(aggs.map((x) => x.agg.n), ctx);

  // Convergence per key = 1 − normalized stddev across sides. Higher = more agreement.
  const derived = keys.map((k) => {
    const values = aggs.map(({ agg }) => agg.values[k.id] ?? 0);
    if (values.length < 2) return { keyId: k.id, value: 1 };
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    // Normalize against value range. For % data, max stddev is bounded by 50.
    const maxRange = Math.max(...values) - Math.min(...values);
    const convergence = maxRange > 0 ? 1 - Math.min(1, stddev / maxRange) : 1;
    return { keyId: k.id, value: convergence };
  });

  const sides: AnalysisSideResult[] = aggs.map(({ side, agg }) => ({
    id: side.id,
    label: side.label,
    n: agg.n,
    questionIds: side.questionIds,
    values: keys.map((k) => ({ keyId: k.id, value: agg.values[k.id] ?? 0 })),
  }));

  return {
    ...baseResult(analysis, lowConfidence),
    n: Math.max(0, ...aggs.map((x) => x.agg.n)),
    keys,
    sides,
    derived,
    unit: unitForOperation(analysis.operation),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function sideDistributionForSubmission(
  questionIds: string[],
  sub: SubmissionLike,
  ctx: AnalysisComputeContext
): Record<string, number> | null {
  const metaMap = new Map(ctx.questionMetas.map((q) => [q.id, q]));
  const answersByQid = new Map<string, ISurveyAnswer>();
  for (const a of sub.answers ?? []) answersByQid.set(a.questionId, a);

  const sumByKey = new Map<string, number>();
  const countByKey = new Map<string, number>();
  let answered = 0;

  for (const qid of questionIds) {
    const qm = metaMap.get(qid);
    if (!qm) continue;
    const answer = answersByQid.get(qid);
    if (!answer) continue;
    const dist = answerDistribution(qm, answer, ctx.rankWeights, ctx.top3Weights);
    if (!dist) continue;
    answered += 1;
    for (const [keyId, v] of Object.entries(dist)) {
      sumByKey.set(keyId, (sumByKey.get(keyId) ?? 0) + v);
      countByKey.set(keyId, (countByKey.get(keyId) ?? 0) + 1);
    }
  }
  if (answered === 0) return null;
  const result: Record<string, number> = {};
  for (const [keyId, sum] of sumByKey.entries()) {
    const cnt = countByKey.get(keyId) ?? 1;
    result[keyId] = sum / cnt;
  }
  return result;
}

function answerDistribution(
  qm: QuestionMeta,
  a: ISurveyAnswer,
  rankWeights: number[],
  top3Weights: number[]
): Record<string, number> | null {
  if (qm.type === "multiple-choice") {
    const sel = a.selectedChoiceIds ?? [];
    if (sel.length === 0) return null;
    const result: Record<string, number> = {};
    const selSet = new Set(sel);
    for (const c of qm.choices ?? []) result[c.id] = selSet.has(c.id) ? 100 : 0;
    return result;
  }
  if (qm.type === "archetype-ranking" || qm.type === "archetype-top3") {
    const isTop3 = qm.type === "archetype-top3";
    const weights = isTop3 ? top3Weights : rankWeights;
    const maxRank = isTop3 ? TOP3_RANK_LENGTH : rankWeights.length;
    const rankings = (a.rankings ?? {}) as Record<string, number>;
    const result: Record<string, number> = {};
    let touched = false;
    let total = 0;
    for (const opt of qm.options ?? []) {
      const rank = Number(rankings[opt.id]);
      if (!rank || rank < 1 || rank > maxRank) continue;
      touched = true;
      const weight = weights[rank - 1] ?? 0;
      result[opt.archetypeId] = (result[opt.archetypeId] ?? 0) + weight;
      total += weight;
    }
    if (!touched) return null;
    if (total > 0) {
      for (const k of Object.keys(result)) {
        result[k] = (result[k] / total) * 100;
      }
    }
    return result;
  }
  if (qm.type === "general-ranking" || qm.type === "general-top3") {
    const rankings = (a.rankings ?? {}) as Record<string, number>;
    const result: Record<string, number> = {};
    let touched = false;
    for (const item of qm.rankingItems ?? []) {
      const rank = Number(rankings[item.id]);
      if (!rank) continue;
      touched = true;
      result[item.id] = rank;
    }
    return touched ? result : null;
  }
  return null;
}


function isLowConfidence(ns: number[], ctx: AnalysisComputeContext): boolean {
  if (ns.length === 0) return false;
  const min = Math.min(...ns);
  return min > 0 && min < ctx.lowConfidenceThreshold;
}

function unitForOperation(op: AnalysisOperation): AnalysisResult["unit"] {
  if (op === "archetype-points") return "points";
  if (op === "ranking-mean") return "rank";
  if (op === "open-text-frequency") return "count";
  if (op === "top-k-overlap") return "count";
  return "percent";
}

function baseResult(analysis: AnalysisConfig, lowConfidence: boolean): AnalysisResult {
  return {
    id: analysis.id,
    title: analysis.title,
    type: analysis.type,
    operation: analysis.operation,
    chartKey: analysis.chartKey,
    n: 0,
    lowConfidence,
    compatibilityBroken: false,
    keys: [],
    sides: [],
  };
}

// ─── Tokenizer ─────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  // English
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was",
  "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old",
  "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use",
  "with", "this", "that", "from", "they", "have", "what", "your", "when", "will", "into",
  "just", "like", "more", "some", "than", "then", "very", "well", "were", "been", "also",
  // Dutch
  "het", "een", "van", "voor", "met", "aan", "bij", "dat", "die", "deze", "dit", "door",
  "naar", "ook", "maar", "niet", "wel", "kan", "kun", "kunt", "wij", "jij", "hij", "zij",
  "wat", "waar", "hoe", "als", "toen", "dan", "ben", "heb", "had", "zal", "zou", "zijn",
  "geen", "veel", "meer", "want", "omdat", "tot", "uit", "over", "onder", "zonder", "tussen",
]);

function countTokens(texts: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const tokens = t
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
    for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// ─── Public dispatcher ─────────────────────────────────────────────────

export function computeAnalysis(
  analysis: AnalysisConfig,
  ctx: AnalysisComputeContext
): AnalysisResult {
  // Compatibility-broken: the saved fingerprint disagrees with current schema.
  const allQids = analysis.sides.flatMap((s) => s.questionIds);
  if (analysis.capabilityFingerprint) {
    const currentFingerprint = computeCapabilityFingerprint(allQids, ctx.questionMetas);
    if (currentFingerprint !== analysis.capabilityFingerprint) {
      return { ...baseResult(analysis, false), compatibilityBroken: true };
    }
  }
  if (analysis.type === "summary") return computeSummary(analysis, ctx);
  return computeComparison(analysis, ctx);
}
