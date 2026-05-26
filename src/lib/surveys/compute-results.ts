import type { ISurveySession } from "@/lib/models/SurveySession";
import type { ISurveySubmission } from "@/lib/models/SurveySubmission";
import type { ResultsData, QuestionResult } from "@/components/survey-results/types";
import { normalizeQuestionType, TOP3_RANK_LENGTH } from "./types";
import { computeAgreement, averageAgreement } from "./agreement";
import { enrichArchetypes, type EnrichedArchetype } from "./enrich-archetypes";
import { buildAccumulators, normalizeArchetypeScores, type QuestionMeta } from "./distributions";
import {
  computeAnalysis,
  type AnalysisConfig,
  type AnalysisResult,
} from "./analyses";

export const LOW_CONFIDENCE_THRESHOLD = 15;

export interface ComputedSurveyResults {
  results: ResultsData;
  questionMetas: QuestionMeta[];
  archetypes: EnrichedArchetype[];
}

/**
 * Compute the full aggregation payload for a survey session — percentages,
 * agreement scores, rank distributions, per-section averages, analyses.
 *
 * Shared between the GET /results route (JSON) and the GET /export route
 * (markdown). Pure with respect to its inputs aside from one DB read in
 * `enrichArchetypes` to refresh archetype name/color from the live collection.
 */
export async function computeSurveyResults(
  surveySession: ISurveySession,
  submissions: ISurveySubmission[]
): Promise<ComputedSurveyResults> {
  const snapshot = surveySession.templateSnapshot;
  const rankWeights = snapshot.rankWeights ?? [5, 4, 3, 2, 1];
  const top3Weights = snapshot.top3Weights ?? [5, 3, 1];
  // Resolve archetype name + color live from the Archetype collection so that
  // changes propagate to historical sessions. Snapshot is fallback only.
  const archetypes = await enrichArchetypes(snapshot.archetypes ?? []);
  const sections = snapshot.sections ?? [];

  // Flatten question metadata
  const questionMetas: QuestionMeta[] = [];
  for (const s of sections) {
    for (const q of s.questions ?? []) {
      questionMetas.push({ ...q, sectionId: s.id, type: normalizeQuestionType(q.type) });
    }
  }
  const questionMetaMap = new Map(questionMetas.map((q) => [q.id, q]));

  const {
    scoreMap,
    rankDistMap,
    rankItemDistMap,
    choiceCountMap,
    openTextAnswersByQuestion,
    legacyOpenTextByQuestion,
    questionN,
  } = buildAccumulators(submissions, questionMetas, rankWeights, top3Weights);

  // Raw decimals to avoid compounding rounding through section/overall averages.
  // Every `percentage` field in the response is still an integer 0..100.
  const archetypeIds = archetypes.map((a) => a.id);
  const archetypeQuestionPercentages = new Map<string, Record<string, number>>();
  for (const qm of questionMetas) {
    if (qm.type === "archetype-ranking" || qm.type === "archetype-top3") {
      archetypeQuestionPercentages.set(qm.id, normalizeArchetypeScores(scoreMap.get(qm.id), archetypeIds));
    }
  }

  function questionAgreement(qm: QuestionMeta): number | null {
    if (qm.type === "archetype-ranking" || qm.type === "archetype-top3") {
      const arcDist = rankDistMap.get(qm.id);
      if (!arcDist) return null;
      return averageAgreement([...arcDist.values()]);
    }
    if (qm.type === "general-ranking" || qm.type === "general-top3") {
      const itemDist = rankItemDistMap.get(qm.id);
      if (!itemDist) return null;
      return averageAgreement([...itemDist.values()]);
    }
    if (qm.type === "multiple-choice") {
      const counts = choiceCountMap.get(qm.id);
      if (!counts) return null;
      const choices = qm.choices ?? [];
      return computeAgreement(choices.map((c) => counts.get(c.id) ?? 0));
    }
    return null;
  }
  const agreementByQuestion = new Map<string, number | null>();
  for (const qm of questionMetas) agreementByQuestion.set(qm.id, questionAgreement(qm));

  const perQuestion: QuestionResult[] = questionMetas.map((qm): QuestionResult => {
    const n = questionN.get(qm.id) ?? 0;
    const lowConfidence = n > 0 && n < LOW_CONFIDENCE_THRESHOLD;
    const agreement = agreementByQuestion.get(qm.id) ?? null;
    const base = {
      questionId: qm.id,
      title: qm.title,
      sectionId: qm.sectionId,
      n,
      lowConfidence,
      agreement,
    };
    switch (qm.type) {
      case "archetype-ranking":
      case "archetype-top3": {
        const isTop3 = qm.type === "archetype-top3";
        const distLen = isTop3 ? TOP3_RANK_LENGTH : rankWeights.length;
        const pct = archetypeQuestionPercentages.get(qm.id) ?? {};
        const points = scoreMap.get(qm.id) ?? new Map<string, number>();
        const totalPoints = [...points.values()].reduce((sum, v) => sum + v, 0);
        return {
          ...base,
          type: qm.type,
          archetypes: archetypes.map((a) => ({
            archetypeId: a.id,
            percentage: Math.round(pct[a.id] ?? 0),
            points: points.get(a.id) ?? 0,
          })),
          totalPoints,
          rankDistribution: Object.fromEntries(
            archetypes.map((a) => [
              a.id,
              rankDistMap.get(qm.id)?.get(a.id) ?? Array(distLen).fill(0),
            ])
          ),
          openTextAnswers: legacyOpenTextByQuestion.get(qm.id) ?? [],
        };
      }
      case "general-ranking":
      case "general-top3": {
        const isTop3 = qm.type === "general-top3";
        const items = qm.rankingItems ?? [];
        const distLen = isTop3 ? TOP3_RANK_LENGTH : items.length;
        const itemDist = rankItemDistMap.get(qm.id);
        const ranked = items.map((it) => {
          const dist = itemDist?.get(it.id) ?? Array(distLen).fill(0);
          const totalAnswers = dist.reduce((sum, v) => sum + v, 0);
          const weightedSum = dist.reduce((sum, count, idx) => sum + count * (idx + 1), 0);
          const avgRank = totalAnswers > 0 ? weightedSum / totalAnswers : 0;
          return { itemId: it.id, text: it.text, averageRank: Math.round(avgRank * 100) / 100, distribution: dist };
        });
        return { ...base, type: qm.type, items: ranked };
      }
      case "multiple-choice": {
        const choices = qm.choices ?? [];
        const counts = choiceCountMap.get(qm.id);
        const totalSelections = n > 0 ? n : 0;
        const distribution = choices.map((c) => {
          const count = counts?.get(c.id) ?? 0;
          const percentage = totalSelections > 0 ? Math.round((count / totalSelections) * 100) : 0;
          return { choiceId: c.id, text: c.text, count, percentage };
        });
        return { ...base, type: "multiple-choice", choiceMode: qm.choiceMode ?? "single", distribution };
      }
      case "open-text":
        return { ...base, type: "open-text", answers: openTextAnswersByQuestion.get(qm.id) ?? [] };
      case "intro":
        return { ...base, type: "intro" };
    }
  });

  const perSection = sections.map((s) => {
    const sectionQuestionIds = (s.questions ?? []).map((q) => q.id);
    const archetypeQuestionIds = sectionQuestionIds.filter((qid) => {
      const t = questionMetaMap.get(qid)?.type;
      return t === "archetype-ranking" || t === "archetype-top3";
    });
    const archetypeAverages: Record<string, number> = {};
    for (const a of archetypes) {
      const vals = archetypeQuestionIds
        .map((qid) => archetypeQuestionPercentages.get(qid)?.[a.id] ?? 0)
        .filter((_, i) => (questionN.get(archetypeQuestionIds[i]) ?? 0) > 0);
      const avg = vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;
      archetypeAverages[a.id] = Math.round(avg);
    }
    const sectionN = Math.max(0, ...archetypeQuestionIds.map((qid) => questionN.get(qid) ?? 0));
    const agreementVals = sectionQuestionIds
      .map((qid) => agreementByQuestion.get(qid))
      .filter((v): v is number => typeof v === "number");
    const sectionAgreement = agreementVals.length > 0
      ? agreementVals.reduce((s, v) => s + v, 0) / agreementVals.length
      : null;
    return {
      sectionId: s.id,
      title: s.title,
      archetypes: archetypes.map((a) => ({ archetypeId: a.id, percentage: archetypeAverages[a.id] })),
      n: sectionN,
      agreement: sectionAgreement,
      openAnswers: submissions
        .flatMap((sub) =>
          (sub.sectionOpenAnswers ?? [])
            .filter((soa) => soa.sectionId === s.id)
            .map((soa) => ({ text: soa.text }))
        ),
    };
  });

  const archetypeQuestionMetas = questionMetas.filter(
    (q) => q.type === "archetype-ranking" || q.type === "archetype-top3"
  );
  const overallArchetypes = archetypes.map((a) => {
    const vals = archetypeQuestionMetas
      .map((qm) => archetypeQuestionPercentages.get(qm.id)?.[a.id] ?? 0)
      .filter((_, i) => (questionN.get(archetypeQuestionMetas[i].id) ?? 0) > 0);
    const avg = vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;
    return { archetypeId: a.id, percentage: Math.round(avg) };
  });
  const overallAgreementVals = questionMetas
    .map((qm) => agreementByQuestion.get(qm.id))
    .filter((v): v is number => typeof v === "number");
  const overallAgreement = overallAgreementVals.length > 0
    ? overallAgreementVals.reduce((s, v) => s + v, 0) / overallAgreementVals.length
    : null;
  const overallN = Math.max(0, ...questionMetas.map((qm) => questionN.get(qm.id) ?? 0));

  const nativeAnalyses: AnalysisConfig[] = (surveySession.analyses ?? [])
    .slice()
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((a) => ({
      id: a.id,
      rank: a.rank ?? 0,
      title: a.title,
      type: a.type,
      operation: a.operation,
      sides: (a.sides ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        questionIds: s.questionIds ?? [],
      })),
      chartKey: a.chartKey,
      capabilityFingerprint: a.capabilityFingerprint,
    }));

  const analysesCtx = {
    questionMetas,
    archetypes,
    acc: {
      scoreMap,
      rankDistMap,
      rankItemDistMap,
      choiceCountMap,
      openTextAnswersByQuestion,
      legacyOpenTextByQuestion,
      questionN,
    },
    submissions,
    rankWeights,
    top3Weights,
    lowConfidenceThreshold: 10,
  };

  const analyses: AnalysisResult[] = nativeAnalyses.map((a) =>
    computeAnalysis(a, analysesCtx)
  );

  const capabilities = {
    hasArchetypeRanking: questionMetas.some(
      (q) => q.type === "archetype-ranking" || q.type === "archetype-top3"
    ),
    hasGeneralRanking: questionMetas.some(
      (q) => q.type === "general-ranking" || q.type === "general-top3"
    ),
    hasArchetypeTop3: questionMetas.some((q) => q.type === "archetype-top3"),
    hasGeneralTop3: questionMetas.some((q) => q.type === "general-top3"),
    hasMultipleChoice: questionMetas.some((q) => q.type === "multiple-choice"),
    hasOpenText:
      questionMetas.some((q) => q.type === "open-text") ||
      submissions.some((s) =>
        (s.sectionOpenAnswers ?? []).some((soa) => (soa.text ?? "").trim().length > 0)
      ) ||
      submissions.some((s) => (s.closingOpenAnswer ?? "").trim().length > 0),
    hasAnalyses: analyses.length > 0,
  };

  const results: ResultsData = {
    participantCount: submissions.length,
    archetypes,
    capabilities,
    overall: {
      archetypes: overallArchetypes,
      n: overallN,
      agreement: overallAgreement,
    },
    perSection,
    perQuestion,
    analyses,
    closingOpenAnswers: submissions
      .filter((s) => s.closingOpenAnswer)
      .map((s) => ({ text: s.closingOpenAnswer! })),
  };

  return { results, questionMetas, archetypes };
}
