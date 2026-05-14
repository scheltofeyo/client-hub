import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { SurveySubmissionModel } from "@/lib/models/SurveySubmission";
import type { ISurveyQuestionSnapshot } from "@/lib/models/SurveySession";
import { normalizeQuestionType } from "@/lib/surveys/types";
import { computeAgreement, averageAgreement } from "@/lib/surveys/agreement";
import { enrichArchetypes } from "@/lib/surveys/enrich-archetypes";

const LOW_CONFIDENCE_THRESHOLD = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const surveySession = await SurveySessionModel.findById(id).lean();
  if (!surveySession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = surveySession.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.viewOthers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await SurveySubmissionModel.find({
    sessionId: id,
    status: "completed",
  }).lean();

  const snapshot = surveySession.templateSnapshot;
  const rankWeights = snapshot.rankWeights ?? [5, 4, 3, 2, 1];
  // Resolve archetype name + color live from the Archetype collection so that
  // changes propagate to historical sessions. Snapshot is fallback only.
  const archetypes = await enrichArchetypes(snapshot.archetypes ?? []);
  const sections = snapshot.sections ?? [];

  // Flatten question metadata
  type QuestionMeta = ISurveyQuestionSnapshot & { sectionId: string };
  const questionMetas: QuestionMeta[] = [];
  for (const s of sections) {
    for (const q of s.questions ?? []) {
      questionMetas.push({ ...q, sectionId: s.id, type: normalizeQuestionType(q.type) });
    }
  }
  const questionMetaMap = new Map(questionMetas.map((q) => [q.id, q]));

  // ── Per-type accumulators ──────────────────────────────────────────

  // archetype-ranking
  const scoreMap = new Map<string, Map<string, number>>(); // qid -> archetypeId -> total points
  const rankDistMap = new Map<string, Map<string, number[]>>(); // qid -> archetypeId -> distribution
  // general-ranking: itemId rank distribution and average
  const rankItemDistMap = new Map<string, Map<string, number[]>>(); // qid -> itemId -> distribution
  // multiple-choice
  const choiceCountMap = new Map<string, Map<string, number>>(); // qid -> choiceId -> selection count
  // open-text
  const openTextAnswersByQuestion = new Map<string, { text: string }[]>();
  // n per question (# completed submissions per question)
  const questionN = new Map<string, number>();
  // legacy: per-question openText comment on archetype-ranking
  const legacyOpenTextByQuestion = new Map<string, { text: string }[]>();

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
          let arcScores = scoreMap.get(meta.id);
          if (!arcScores) { arcScores = new Map(); scoreMap.set(meta.id, arcScores); }
          arcScores.set(opt.archetypeId, (arcScores.get(opt.archetypeId) ?? 0) + weight);

          let arcDist = rankDistMap.get(meta.id);
          if (!arcDist) { arcDist = new Map(); rankDistMap.set(meta.id, arcDist); }
          let dist = arcDist.get(opt.archetypeId);
          if (!dist) { dist = Array(rankWeights.length).fill(0); arcDist.set(opt.archetypeId, dist); }
          dist[rank - 1] += 1;
        }
        if (answered) questionN.set(meta.id, (questionN.get(meta.id) ?? 0) + 1);
        if (a.openText) {
          const arr = legacyOpenTextByQuestion.get(meta.id) ?? [];
          arr.push({ text: a.openText });
          legacyOpenTextByQuestion.set(meta.id, arr);
        }
      } else if (answerType === "general-ranking" && meta.type === "general-ranking") {
        const rankings = (a.rankings ?? {}) as Record<string, number>;
        const items = meta.rankingItems ?? [];
        const maxRank = items.length;
        let answered = false;
        let itemDist = rankItemDistMap.get(meta.id);
        if (!itemDist) { itemDist = new Map(); rankItemDistMap.set(meta.id, itemDist); }
        for (const item of items) {
          const rank = Number(rankings[item.id]);
          if (!rank || rank < 1 || rank > maxRank) continue;
          answered = true;
          let dist = itemDist.get(item.id);
          if (!dist) { dist = Array(maxRank).fill(0); itemDist.set(item.id, dist); }
          dist[rank - 1] += 1;
        }
        if (answered) questionN.set(meta.id, (questionN.get(meta.id) ?? 0) + 1);
      } else if (answerType === "multiple-choice" && meta.type === "multiple-choice") {
        const sel = a.selectedChoiceIds ?? [];
        if (sel.length === 0) continue;
        let counts = choiceCountMap.get(meta.id);
        if (!counts) { counts = new Map(); choiceCountMap.set(meta.id, counts); }
        for (const cid of sel) {
          counts.set(cid, (counts.get(cid) ?? 0) + 1);
        }
        questionN.set(meta.id, (questionN.get(meta.id) ?? 0) + 1);
      } else if (answerType === "open-text" && meta.type === "open-text") {
        const text = (a.text ?? "").trim();
        if (text) {
          const arr = openTextAnswersByQuestion.get(meta.id) ?? [];
          arr.push({ text });
          openTextAnswersByQuestion.set(meta.id, arr);
          questionN.set(meta.id, (questionN.get(meta.id) ?? 0) + 1);
        }
      }
    }
  }

  // ── Normalization helpers ──────────────────────────────────────────
  // NOTE: We compute internally in raw decimals to avoid compounding rounding
  // through section/overall/comparison averages. We only round to integer at
  // the final response shape. To keep the wire format stable, every
  // `percentage: number` field in the response is still an integer 0..100.
  // A future optional `weightByN` aggregation toggle is a TODO — today every
  // question contributes equally to its section/overall regardless of n.

  function normalize(arcMap: Map<string, number> | undefined): Record<string, number> {
    const result: Record<string, number> = {};
    if (!arcMap) {
      for (const a of archetypes) result[a.id] = 0;
      return result;
    }
    const total = [...arcMap.values()].reduce((sum, v) => sum + v, 0);
    for (const a of archetypes) {
      const v = arcMap.get(a.id) ?? 0;
      result[a.id] = total > 0 ? (v / total) * 100 : 0;
    }
    return result;
  }
  // For archetype-ranking questions only — raw decimal percentages
  const archetypeQuestionPercentages = new Map<string, Record<string, number>>();
  for (const qm of questionMetas) {
    if (qm.type === "archetype-ranking") {
      archetypeQuestionPercentages.set(qm.id, normalize(scoreMap.get(qm.id)));
    }
  }

  // ── Agreement (0..1) per question ──────────────────────────────────

  function questionAgreement(qm: QuestionMeta): number | null {
    if (qm.type === "archetype-ranking") {
      const arcDist = rankDistMap.get(qm.id);
      if (!arcDist) return null;
      return averageAgreement([...arcDist.values()]);
    }
    if (qm.type === "general-ranking") {
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

  // ── Per-question response shape ────────────────────────────────────

  const perQuestion = questionMetas.map((qm) => {
    const n = questionN.get(qm.id) ?? 0;
    const lowConfidence = n > 0 && n < LOW_CONFIDENCE_THRESHOLD;
    const agreement = agreementByQuestion.get(qm.id) ?? null;
    const base = {
      questionId: qm.id,
      title: qm.title,
      sectionId: qm.sectionId,
      type: qm.type,
      n,
      lowConfidence,
      agreement,
    };
    switch (qm.type) {
      case "archetype-ranking": {
        const pct = archetypeQuestionPercentages.get(qm.id) ?? {};
        const points = scoreMap.get(qm.id) ?? new Map<string, number>();
        const totalPoints = [...points.values()].reduce((sum, v) => sum + v, 0);
        return {
          ...base,
          archetypes: archetypes.map((a) => ({
            archetypeId: a.id,
            percentage: Math.round(pct[a.id] ?? 0),
            points: points.get(a.id) ?? 0,
          })),
          totalPoints,
          rankDistribution: Object.fromEntries(
            archetypes.map((a) => [
              a.id,
              rankDistMap.get(qm.id)?.get(a.id) ?? Array(rankWeights.length).fill(0),
            ])
          ),
          openTextAnswers: legacyOpenTextByQuestion.get(qm.id) ?? [],
        };
      }
      case "general-ranking": {
        const items = qm.rankingItems ?? [];
        const itemDist = rankItemDistMap.get(qm.id);
        const ranked = items.map((it) => {
          const dist = itemDist?.get(it.id) ?? Array(items.length).fill(0);
          const totalAnswers = dist.reduce((sum, v) => sum + v, 0);
          const weightedSum = dist.reduce((sum, count, idx) => sum + count * (idx + 1), 0);
          const avgRank = totalAnswers > 0 ? weightedSum / totalAnswers : 0;
          return { itemId: it.id, text: it.text, averageRank: Math.round(avgRank * 100) / 100, distribution: dist };
        });
        return { ...base, items: ranked };
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
        return { ...base, choiceMode: qm.choiceMode ?? "single", distribution };
      }
      case "open-text":
        return { ...base, answers: openTextAnswersByQuestion.get(qm.id) ?? [] };
      case "intro":
        return { ...base };
    }
  });

  // ── Per-section: average archetype-ranking percentages within section ────────

  const perSection = sections.map((s) => {
    const sectionQuestionIds = (s.questions ?? []).map((q) => q.id);
    const archetypeQuestionIds = sectionQuestionIds.filter(
      (qid) => questionMetaMap.get(qid)?.type === "archetype-ranking"
    );
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

  // ── Overall: average of archetype-ranking percentages ────────────

  const archetypeQuestionMetas = questionMetas.filter((q) => q.type === "archetype-ranking");
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

  // ── Comparisons (archetype-ranking only for now) ────────────────

  const sessionOverrides = surveySession.sessionComparisons ?? [];
  const effectiveComparisons = sessionOverrides.length > 0
    ? sessionOverrides
    : (snapshot.comparisons ?? []);

  function averagePercentageRaw(questionIds: string[], archetypeId: string): number {
    const filtered = questionIds.filter((qid) => questionMetaMap.get(qid)?.type === "archetype-ranking");
    const vals = filtered
      .map((qid) => archetypeQuestionPercentages.get(qid)?.[archetypeId] ?? 0)
      .filter((_, i) => (questionN.get(filtered[i]) ?? 0) > 0);
    return vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;
  }

  const comparisons = effectiveComparisons.map((c) => {
    const leftRaw = archetypes.map((a) => averagePercentageRaw(c.leftQuestionIds ?? [], a.id));
    const rightRaw = archetypes.map((a) => averagePercentageRaw(c.rightQuestionIds ?? [], a.id));
    const left = archetypes.map((a, i) => ({ archetypeId: a.id, percentage: Math.round(leftRaw[i]) }));
    const right = archetypes.map((a, i) => ({ archetypeId: a.id, percentage: Math.round(rightRaw[i]) }));
    const gap = archetypes.map((a, i) => ({
      archetypeId: a.id,
      delta: Math.round(leftRaw[i] - rightRaw[i]),
    }));
    const allIds = [...(c.leftQuestionIds ?? []), ...(c.rightQuestionIds ?? [])];
    const n = Math.max(0, ...allIds.map((qid) => questionN.get(qid) ?? 0));
    const cmpAgreementVals = allIds
      .map((qid) => agreementByQuestion.get(qid))
      .filter((v): v is number => typeof v === "number");
    const cmpAgreement = cmpAgreementVals.length > 0
      ? cmpAgreementVals.reduce((s, v) => s + v, 0) / cmpAgreementVals.length
      : null;
    return {
      id: c.id,
      label: c.label,
      leftLabel: c.leftLabel,
      rightLabel: c.rightLabel,
      left,
      right,
      gap,
      n,
      agreement: cmpAgreement,
    };
  });

  // ── Capabilities ─ drives the type-aware UI ────────────────────────

  const capabilities = {
    hasArchetypeRanking: questionMetas.some((q) => q.type === "archetype-ranking"),
    hasGeneralRanking: questionMetas.some((q) => q.type === "general-ranking"),
    hasMultipleChoice: questionMetas.some((q) => q.type === "multiple-choice"),
    hasOpenText:
      questionMetas.some((q) => q.type === "open-text") ||
      submissions.some((s) =>
        (s.sectionOpenAnswers ?? []).some((soa) => (soa.text ?? "").trim().length > 0)
      ) ||
      submissions.some((s) => (s.closingOpenAnswer ?? "").trim().length > 0),
    hasComparisons: effectiveComparisons.length > 0,
  };

  return NextResponse.json({
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
    comparisons,
    closingOpenAnswers: submissions
      .filter((s) => s.closingOpenAnswer)
      .map((s) => ({ text: s.closingOpenAnswer! })),
  });
}
