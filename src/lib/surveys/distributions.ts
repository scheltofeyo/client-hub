import type { ISurveyQuestionSnapshot } from "@/lib/models/SurveySession";
import type { ISurveyAnswer } from "@/lib/models/SurveySubmission";
import { normalizeQuestionType } from "./types";

export type QuestionMeta = ISurveyQuestionSnapshot & { sectionId: string };

export interface SubmissionLike {
  answers?: ISurveyAnswer[];
}

export interface SurveyAccumulators {
  /** archetype-ranking: qid → archetypeId → total points */
  scoreMap: Map<string, Map<string, number>>;
  /** archetype-ranking: qid → archetypeId → rank-bucket distribution */
  rankDistMap: Map<string, Map<string, number[]>>;
  /** general-ranking: qid → itemId → rank-bucket distribution */
  rankItemDistMap: Map<string, Map<string, number[]>>;
  /** multiple-choice: qid → choiceId → selection count */
  choiceCountMap: Map<string, Map<string, number>>;
  /** open-text: qid → list of submitted answers */
  openTextAnswersByQuestion: Map<string, { text: string }[]>;
  /** Legacy free-text comments attached to archetype-ranking answers */
  legacyOpenTextByQuestion: Map<string, { text: string }[]>;
  /** qid → number of completed submissions that answered the question */
  questionN: Map<string, number>;
}

export function emptyAccumulators(): SurveyAccumulators {
  return {
    scoreMap: new Map(),
    rankDistMap: new Map(),
    rankItemDistMap: new Map(),
    choiceCountMap: new Map(),
    openTextAnswersByQuestion: new Map(),
    legacyOpenTextByQuestion: new Map(),
    questionN: new Map(),
  };
}

/**
 * Walk submissions once and bucket answers per question by type.
 * Behaviour-preserving extract of the per-question accumulator pass that
 * previously lived inline in the survey-results route.
 */
export function buildAccumulators(
  submissions: SubmissionLike[],
  questionMetas: QuestionMeta[],
  rankWeights: number[]
): SurveyAccumulators {
  const acc = emptyAccumulators();
  const questionMetaMap = new Map(questionMetas.map((q) => [q.id, q]));

  for (const sub of submissions) {
    for (const a of sub.answers ?? []) {
      const meta = questionMetaMap.get(a.questionId);
      if (!meta) continue;
      const answerType = normalizeQuestionType(a.type ?? meta.type);

      if (answerType === "archetype-ranking" && meta.type === "archetype-ranking") {
        const rankings = (a.rankings ?? {}) as Record<string, number>;
        let answered = false;
        for (const opt of meta.options ?? []) {
          const rank = Number(rankings[opt.id]);
          if (!rank || rank < 1 || rank > rankWeights.length) continue;
          answered = true;
          const weight = rankWeights[rank - 1] ?? 0;
          let arcScores = acc.scoreMap.get(meta.id);
          if (!arcScores) { arcScores = new Map(); acc.scoreMap.set(meta.id, arcScores); }
          arcScores.set(opt.archetypeId, (arcScores.get(opt.archetypeId) ?? 0) + weight);

          let arcDist = acc.rankDistMap.get(meta.id);
          if (!arcDist) { arcDist = new Map(); acc.rankDistMap.set(meta.id, arcDist); }
          let dist = arcDist.get(opt.archetypeId);
          if (!dist) { dist = Array(rankWeights.length).fill(0); arcDist.set(opt.archetypeId, dist); }
          dist[rank - 1] += 1;
        }
        if (answered) acc.questionN.set(meta.id, (acc.questionN.get(meta.id) ?? 0) + 1);
        if (a.openText) {
          const arr = acc.legacyOpenTextByQuestion.get(meta.id) ?? [];
          arr.push({ text: a.openText });
          acc.legacyOpenTextByQuestion.set(meta.id, arr);
        }
      } else if (answerType === "general-ranking" && meta.type === "general-ranking") {
        const rankings = (a.rankings ?? {}) as Record<string, number>;
        const items = meta.rankingItems ?? [];
        const maxRank = items.length;
        let answered = false;
        let itemDist = acc.rankItemDistMap.get(meta.id);
        if (!itemDist) { itemDist = new Map(); acc.rankItemDistMap.set(meta.id, itemDist); }
        for (const item of items) {
          const rank = Number(rankings[item.id]);
          if (!rank || rank < 1 || rank > maxRank) continue;
          answered = true;
          let dist = itemDist.get(item.id);
          if (!dist) { dist = Array(maxRank).fill(0); itemDist.set(item.id, dist); }
          dist[rank - 1] += 1;
        }
        if (answered) acc.questionN.set(meta.id, (acc.questionN.get(meta.id) ?? 0) + 1);
      } else if (answerType === "multiple-choice" && meta.type === "multiple-choice") {
        const sel = a.selectedChoiceIds ?? [];
        if (sel.length === 0) continue;
        let counts = acc.choiceCountMap.get(meta.id);
        if (!counts) { counts = new Map(); acc.choiceCountMap.set(meta.id, counts); }
        for (const cid of sel) {
          counts.set(cid, (counts.get(cid) ?? 0) + 1);
        }
        acc.questionN.set(meta.id, (acc.questionN.get(meta.id) ?? 0) + 1);
      } else if (answerType === "open-text" && meta.type === "open-text") {
        const text = (a.text ?? "").trim();
        if (text) {
          const arr = acc.openTextAnswersByQuestion.get(meta.id) ?? [];
          arr.push({ text });
          acc.openTextAnswersByQuestion.set(meta.id, arr);
          acc.questionN.set(meta.id, (acc.questionN.get(meta.id) ?? 0) + 1);
        }
      }
    }
  }

  return acc;
}

/**
 * Convert raw archetype scores for one question into percentages keyed by
 * archetype id. Returns 0 for every archetype when the total is zero so
 * downstream code never has to defend against undefined.
 */
export function normalizeArchetypeScores(
  arcMap: Map<string, number> | undefined,
  archetypeIds: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!arcMap) {
    for (const id of archetypeIds) result[id] = 0;
    return result;
  }
  const total = [...arcMap.values()].reduce((sum, v) => sum + v, 0);
  for (const id of archetypeIds) {
    const v = arcMap.get(id) ?? 0;
    result[id] = total > 0 ? (v / total) * 100 : 0;
  }
  return result;
}
