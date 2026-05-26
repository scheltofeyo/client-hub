import type { ISurveySession, ISurveyQuestionSnapshot } from "@/lib/models/SurveySession";
import type { ISurveySubmission, ISurveyAnswer } from "@/lib/models/SurveySubmission";
import type { ResultsData, QuestionResult } from "@/components/survey-results/types";
import type { EnrichedArchetype } from "./enrich-archetypes";
import type { QuestionMeta } from "./distributions";
import { LOW_CONFIDENCE_THRESHOLD } from "./compute-results";
import { TOP3_RANK_LENGTH } from "./types";

export interface BuildMarkdownInput {
  session: ISurveySession;
  archetypes: EnrichedArchetype[];
  results: ResultsData;
  /** Only completed submissions, sorted oldest-first for stable Deelnemer N labels. */
  submissions: ISurveySubmission[];
  questionMetas: QuestionMeta[];
}

/**
 * Build a complete, self-describing markdown export of a survey session's
 * results — aggregated stats + anonymised per-participant raw answers + every
 * piece of context an LLM needs to interpret the numbers without prior
 * knowledge of the survey domain.
 *
 * Pure: no DB calls, no auth. The route handler does both.
 */
export function buildSurveyResultsMarkdown(input: BuildMarkdownInput): string {
  const { session, archetypes, results, submissions, questionMetas } = input;
  const snapshot = session.templateSnapshot;
  const rankWeights = snapshot.rankWeights ?? [5, 4, 3, 2, 1];
  const top3Weights = snapshot.top3Weights ?? [5, 3, 1];

  const archetypeNameById = new Map(archetypes.map((a) => [a.id, a.name]));
  const questionMetaById = new Map(questionMetas.map((q) => [q.id, q]));
  const sectionTitleById = new Map(
    (snapshot.sections ?? []).map((s) => [s.id, s.title])
  );

  // Stable Deelnemer N labels: sort oldest-first, fall back to createdAt.
  const orderedSubmissions = [...submissions].sort((a, b) => {
    const at = a.submittedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
    const bt = b.submittedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
    return at - bt;
  });

  const out: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────
  out.push(`# ${session.title}`);
  out.push("");
  out.push(`- **Template:** ${snapshot.name || "—"}`);
  out.push(`- **Status:** ${session.status}`);
  out.push(`- **Aangemaakt:** ${fmtDateTime(session.createdAt)}`);
  if (session.openedAt) out.push(`- **Geopend:** ${fmtDateTime(session.openedAt)}`);
  if (session.closedAt) out.push(`- **Gesloten:** ${fmtDateTime(session.closedAt)}`);
  out.push(`- **Respondenten (completed):** ${results.participantCount}`);
  out.push(`- **Aggregatieversie:** ${session.aggregationVersion}`);
  out.push("");
  if (snapshot.description?.trim()) {
    out.push(`> ${snapshot.description.trim().replace(/\n/g, "\n> ")}`);
    out.push("");
  }

  // ── Scoring-instellingen ───────────────────────────────────────────────
  out.push("## Scoring-instellingen");
  out.push("");
  out.push(
    `- **rankWeights**: \`[${rankWeights.join(", ")}]\` — gewichten per positie voor \`archetype-ranking\` en \`general-ranking\` (rank 1 = eerste waarde).`
  );
  out.push(
    `- **top3Weights**: \`[${top3Weights.join(", ")}]\` — gewichten voor positie 1/2/3 in \`archetype-top3\` en \`general-top3\`.`
  );
  out.push(
    `- **aggregationVersion**: \`${session.aggregationVersion}\` — gepinde reken-pipeline; historische sessies blijven hierdoor stabiel.`
  );
  out.push(
    `- **lowConfidenceThreshold**: \`${LOW_CONFIDENCE_THRESHOLD}\` — vragen met n minder dan deze waarde worden als 'lowConfidence' gemarkeerd.`
  );
  const mcOverrides = questionMetas.filter(
    (q) => q.type === "multiple-choice" && typeof q.maxSelections === "number"
  );
  if (mcOverrides.length > 0) {
    out.push("- **Per multiple-choice-vraag met override:**");
    for (const q of mcOverrides) {
      out.push(`  - "${escapeInline(q.title)}" → \`maxSelections = ${q.maxSelections}\``);
    }
  }
  out.push("");
  out.push(
    "Concrete waarden komen uit deze specifieke sessie — niet uit hardcoded defaults — zodat een LLM precies kan terugrekenen waar percentages en punten vandaan komen."
  );
  out.push("");

  // ── Leesinstructie ─────────────────────────────────────────────────────
  out.push("## Hoe je deze export leest");
  out.push("");
  out.push("- **n** = aantal completed submissions dat op die vraag heeft geantwoord.");
  out.push("- **agreement** (0..1) = mate van onderlinge overeenkomst tussen deelnemers.");
  out.push(`- **lowConfidence** = true wanneer n < ${LOW_CONFIDENCE_THRESHOLD}.`);
  out.push("- Alle percentages zijn afgerond op hele getallen.");
  out.push("- Deelnemers worden genummerd op volgorde van inzending (oudste = Deelnemer 1). Namen en e-mailadressen zijn weggelaten.");
  out.push("");

  // ── Archetypen ─────────────────────────────────────────────────────────
  if (archetypes.length > 0) {
    out.push("## Archetypen");
    out.push("");
    out.push("| ID | Naam | Beschrijving |");
    out.push("|---|---|---|");
    for (const a of archetypes) {
      out.push(
        `| \`${a.id}\` | ${escapeCell(a.name)} | ${escapeCell(a.description ?? "")} |`
      );
    }
    out.push("");
  }

  // ── Overall ────────────────────────────────────────────────────────────
  out.push("## Overall");
  out.push("");
  out.push(`- **n:** ${results.overall.n}`);
  out.push(`- **agreement:** ${fmtAgreement(results.overall.agreement)}`);
  if (results.overall.archetypes.length > 0) {
    out.push("");
    out.push("**Verdeling archetypen (gemiddelde over alle archetype-ranking en -top3 vragen):**");
    out.push("");
    out.push("| Archetype | Percentage |");
    out.push("|---|---|");
    for (const a of results.overall.archetypes) {
      const name = archetypeNameById.get(a.archetypeId) ?? a.archetypeId;
      out.push(`| ${escapeCell(name)} | ${a.percentage}% |`);
    }
  }
  out.push("");

  // ── Resultaten per vraag, gegroepeerd per sectie ───────────────────────
  const visibleQuestions = results.perQuestion.filter((q) => q.type !== "intro");
  if (visibleQuestions.length > 0) {
    out.push("## Resultaten per vraag");
    out.push("");

    let lastSectionId: string | null = null;
    let qIndex = 0;
    for (const q of visibleQuestions) {
      if (q.sectionId !== lastSectionId) {
        const sectionTitle = sectionTitleById.get(q.sectionId) ?? "—";
        out.push(`### Sectie: ${sectionTitle}`);
        const section = (snapshot.sections ?? []).find((s) => s.id === q.sectionId);
        if (section?.description?.trim()) {
          out.push("");
          out.push(`> ${section.description.trim().replace(/\n/g, "\n> ")}`);
        }
        out.push("");
        lastSectionId = q.sectionId;
      }

      qIndex += 1;
      out.push(`#### Vraag ${qIndex}. ${escapeInline(q.title)}  (\`${q.type}\`)`);
      out.push("");
      out.push(`*Hoe deze vraag werkt:* ${questionTypeExplanation(q.type, questionMetaById.get(q.questionId), rankWeights, top3Weights)}`);
      out.push("");
      out.push(`- **n:** ${q.n}`);
      out.push(`- **agreement:** ${fmtAgreement(q.agreement)}`);
      if (q.lowConfidence) out.push(`- **lowConfidence:** ja (n < ${LOW_CONFIDENCE_THRESHOLD})`);
      out.push("");

      renderQuestionResult(out, q, archetypeNameById);
      out.push("");
    }
  }

  // ── Analyses ───────────────────────────────────────────────────────────
  if (results.analyses && results.analyses.length > 0) {
    out.push("## Analyses");
    out.push("");
    for (const a of results.analyses) {
      out.push(`### ${escapeInline(a.title)}  (\`${a.operation}\`)`);
      out.push("");
      if (a.sides && a.sides.length > 0) {
        out.push("| Kant | n | Waarden |");
        out.push("|---|---|---|");
        for (const side of a.sides) {
          const values = (side.values ?? [])
            .map((v) => `${v.keyId}=${roundTo(v.value, 2)}`)
            .join(", ");
          out.push(
            `| ${escapeCell(side.label || side.id)} | ${side.n} | ${escapeCell(values || "—")} |`
          );
        }
        out.push("");
      }
    }
  }

  // ── Afsluitende vraag ──────────────────────────────────────────────────
  if (results.closingOpenAnswers && results.closingOpenAnswers.length > 0) {
    out.push("## Afsluitende vraag");
    out.push("");
    if (snapshot.closingOpenQuestion?.label) {
      out.push(`*Vraag:* ${escapeInline(snapshot.closingOpenQuestion.label)}`);
      out.push("");
    }
    for (const a of results.closingOpenAnswers) {
      out.push(`- ${escapeBullet(a.text)}`);
    }
    out.push("");
  }

  // ── Per-deelnemer antwoorden ───────────────────────────────────────────
  if (orderedSubmissions.length > 0) {
    out.push("## Per-deelnemer antwoorden");
    out.push("");
    out.push("Deelnemers zijn genummerd op volgorde van inzending. Geen namen of e-mailadressen.");
    out.push("");

    orderedSubmissions.forEach((sub, idx) => {
      const label = `Deelnemer ${idx + 1}`;
      out.push(`### ${label}`);
      out.push("");
      if (sub.submittedAt) out.push(`- **Ingediend:** ${fmtDateTime(sub.submittedAt)}`);
      out.push("");

      const answersByQuestion = new Map<string, ISurveyAnswer>();
      for (const ans of sub.answers ?? []) {
        answersByQuestion.set(ans.questionId, ans);
      }

      const sectionOpenByMap = new Map<string, string>();
      for (const soa of sub.sectionOpenAnswers ?? []) {
        if (soa.text?.trim()) sectionOpenByMap.set(soa.sectionId, soa.text);
      }

      let lastSecId: string | null = null;
      for (const section of snapshot.sections ?? []) {
        const renderableQuestions = (section.questions ?? []).filter(
          (q) => q.type !== "intro"
        );
        const hasContent =
          renderableQuestions.some((q) => answersByQuestion.has(q.id)) ||
          sectionOpenByMap.has(section.id);
        if (!hasContent) continue;
        if (section.id !== lastSecId) {
          out.push(`#### Sectie: ${section.title}`);
          out.push("");
          lastSecId = section.id;
        }
        for (const qSnap of renderableQuestions) {
          const ans = answersByQuestion.get(qSnap.id);
          if (!ans) continue;
          renderParticipantAnswer(out, qSnap, ans, archetypeNameById);
        }
        const sectionOpen = sectionOpenByMap.get(section.id);
        if (sectionOpen) {
          out.push(`- **Sectie-toelichting:** ${escapeBullet(sectionOpen)}`);
        }
        out.push("");
      }

      if (sub.closingOpenAnswer?.trim()) {
        out.push(`- **Afsluitende vraag:** ${escapeBullet(sub.closingOpenAnswer)}`);
        out.push("");
      }
    });
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ─── Per-question-type explanation ────────────────────────────────────────

function questionTypeExplanation(
  type: QuestionResult["type"],
  meta: QuestionMeta | undefined,
  rankWeights: number[],
  top3Weights: number[]
): string {
  switch (type) {
    case "archetype-ranking":
      return `Deelnemers rangschikken **alle** opties van meest naar minst herkenbaar. Elke optie hoort bij een archetype. Ranks tellen mee volgens gewichten \`[${rankWeights.join(", ")}]\` (rank 1 = hoogste gewicht). Het percentage per archetype is het aandeel van de behaalde punten ten opzichte van het totaal.`;
    case "archetype-top3":
      return `Deelnemers kiezen hun **top ${TOP3_RANK_LENGTH}** opties. Plaatsen 1/2/3 krijgen respectievelijk \`[${top3Weights.join(", ")}]\` punten. Niet-gekozen opties krijgen 0 punten. Percentage is het aandeel van de behaalde punten per archetype.`;
    case "general-ranking":
      return `Deelnemers rangschikken alle items van hoog naar laag. \`averageRank\` is het gemiddelde van de gekozen posities — een lagere waarde betekent dat het item gemiddeld hoger werd gewaardeerd.`;
    case "general-top3":
      return `Deelnemers kiezen hun top ${TOP3_RANK_LENGTH} items uit een grotere lijst. \`averageRank\` weegt alleen de gekozen posities — niet-gekozen items hebben een lege distributie.`;
    case "multiple-choice": {
      const mode = meta?.choiceMode ?? "single";
      if (mode === "single") {
        return "Eén keuze per deelnemer. **Percentage** = aandeel deelnemers dat die optie koos.";
      }
      const max = typeof meta?.maxSelections === "number" ? meta.maxSelections : null;
      return `Meerdere keuzes toegestaan${max !== null ? ` (max ${max})` : ""}. **Percentage** = aandeel deelnemers dat die optie aanvinkte.`;
    }
    case "open-text":
      return "Vrije tekst, geen scoring. De antwoorden hieronder zijn de letterlijke inzendingen van deelnemers.";
    case "intro":
      return "Niet-scoring informatieblok dat aan deelnemers wordt getoond vóór de vragen die erop volgen.";
  }
}

// ─── Aggregated per-question rendering ────────────────────────────────────

function renderQuestionResult(
  out: string[],
  q: QuestionResult,
  archetypeNameById: Map<string, string>
): void {
  switch (q.type) {
    case "archetype-ranking":
    case "archetype-top3": {
      if (q.archetypes.length > 0) {
        out.push("| Archetype | % | Punten |");
        out.push("|---|---|---|");
        const sorted = [...q.archetypes].sort((a, b) => b.points - a.points);
        for (const a of sorted) {
          const name = archetypeNameById.get(a.archetypeId) ?? a.archetypeId;
          out.push(`| ${escapeCell(name)} | ${a.percentage}% | ${a.points} |`);
        }
        out.push("");
      }
      const distEntries = Object.entries(q.rankDistribution);
      const firstDist = distEntries[0]?.[1];
      if (firstDist && firstDist.length > 0) {
        const headers = ["Archetype"];
        for (let i = 0; i < firstDist.length; i++) headers.push(`Rank ${i + 1}`);
        out.push(`| ${headers.join(" | ")} |`);
        out.push(`| ${headers.map(() => "---").join(" | ")} |`);
        for (const [archId, dist] of distEntries) {
          const name = archetypeNameById.get(archId) ?? archId;
          out.push(`| ${escapeCell(name)} | ${dist.join(" | ")} |`);
        }
      }
      if (q.openTextAnswers && q.openTextAnswers.length > 0) {
        out.push("");
        out.push("**Toelichting bij deze vraag (legacy open-text):**");
        for (const ans of q.openTextAnswers) {
          out.push(`- ${escapeBullet(ans.text)}`);
        }
      }
      return;
    }
    case "general-ranking":
    case "general-top3": {
      if (q.items.length === 0) return;
      const firstDist = q.items[0].distribution;
      const headers = ["Item", "Gem. rank"];
      for (let i = 0; i < firstDist.length; i++) headers.push(`Rank ${i + 1}`);
      out.push(`| ${headers.join(" | ")} |`);
      out.push(`| ${headers.map(() => "---").join(" | ")} |`);
      const sorted = [...q.items].sort(
        (a, b) => (a.averageRank || Infinity) - (b.averageRank || Infinity)
      );
      for (const it of sorted) {
        const avg = it.averageRank > 0 ? it.averageRank.toFixed(2) : "—";
        out.push(`| ${escapeCell(it.text)} | ${avg} | ${it.distribution.join(" | ")} |`);
      }
      return;
    }
    case "multiple-choice": {
      if (q.distribution.length === 0) return;
      out.push("| Optie | Aantal | % |");
      out.push("|---|---|---|");
      const sorted = [...q.distribution].sort((a, b) => b.count - a.count);
      for (const c of sorted) {
        out.push(`| ${escapeCell(c.text)} | ${c.count} | ${c.percentage}% |`);
      }
      return;
    }
    case "open-text": {
      if (q.answers.length === 0) {
        out.push("_Geen antwoorden._");
        return;
      }
      for (const ans of q.answers) {
        out.push(`- ${escapeBullet(ans.text)}`);
      }
      return;
    }
    case "intro":
      return;
  }
}

// ─── Per-participant raw answer rendering ─────────────────────────────────

function renderParticipantAnswer(
  out: string[],
  qSnap: ISurveyQuestionSnapshot,
  ans: ISurveyAnswer,
  archetypeNameById: Map<string, string>
): void {
  const header = `- **${escapeInline(qSnap.title)}** (\`${qSnap.type}\`)`;
  switch (qSnap.type) {
    case "archetype-ranking":
    case "archetype-top3": {
      const rankings = (ans.rankings ?? {}) as Record<string, number>;
      const entries = Object.entries(rankings)
        .map(([optId, rank]) => ({ optId, rank: Number(rank) }))
        .filter((e) => e.rank > 0)
        .sort((a, b) => a.rank - b.rank);
      if (entries.length === 0) {
        out.push(`${header}`);
        out.push(`  - _Geen rangschikking._`);
        return;
      }
      out.push(header);
      for (const { optId, rank } of entries) {
        const opt = (qSnap.options ?? []).find((o) => o.id === optId);
        const arc = opt ? archetypeNameById.get(opt.archetypeId) ?? opt.archetypeId : "?";
        const optText = opt?.text?.trim() ? `"${escapeInline(opt.text)}"` : `(${optId})`;
        out.push(`  - Rank ${rank}: ${optText} → ${escapeInline(arc)}`);
      }
      if (ans.openText?.trim()) {
        out.push(`  - Toelichting: ${escapeBullet(ans.openText)}`);
      }
      return;
    }
    case "general-ranking":
    case "general-top3": {
      const rankings = (ans.rankings ?? {}) as Record<string, number>;
      const entries = Object.entries(rankings)
        .map(([itemId, rank]) => ({ itemId, rank: Number(rank) }))
        .filter((e) => e.rank > 0)
        .sort((a, b) => a.rank - b.rank);
      if (entries.length === 0) {
        out.push(`${header}`);
        out.push(`  - _Geen rangschikking._`);
        return;
      }
      out.push(header);
      for (const { itemId, rank } of entries) {
        const item = (qSnap.rankingItems ?? []).find((i) => i.id === itemId);
        const itemText = item?.text?.trim() ? `"${escapeInline(item.text)}"` : `(${itemId})`;
        out.push(`  - Rank ${rank}: ${itemText}`);
      }
      return;
    }
    case "multiple-choice": {
      const selected = ans.selectedChoiceIds ?? [];
      if (selected.length === 0) {
        out.push(`${header}`);
        out.push(`  - _Geen keuze._`);
        return;
      }
      const labels = selected.map((cid) => {
        const c = (qSnap.choices ?? []).find((c) => c.id === cid);
        return c?.text?.trim() ? c.text : cid;
      });
      out.push(header);
      out.push(`  - Gekozen: ${labels.map((l) => `"${escapeInline(l)}"`).join(", ")}`);
      return;
    }
    case "open-text": {
      const text = (ans.text ?? "").trim();
      if (!text) return;
      out.push(header);
      out.push(`  - "${escapeBullet(text)}"`);
      return;
    }
    case "intro":
      return;
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────

function fmtDateTime(d: Date | undefined): string {
  if (!d) return "—";
  // Stable ISO-ish format: YYYY-MM-DD HH:mm UTC offset omitted (sessions are
  // tracked in app timezone but for export readability we keep ISO date + HH:mm).
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function fmtAgreement(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(2);
}

function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Escape user-supplied text safe for inline markdown — neutralises pipes (table
 *  cells), backticks (inline code) and collapses newlines so a long answer
 *  doesn't break tables. */
function escapeCell(text: string): string {
  return String(text ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/** Same as escapeCell but preserves line content (used outside tables). */
function escapeInline(text: string): string {
  return String(text ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/** For bullet content — escapes table-pipes lightly, keeps newlines indented. */
function escapeBullet(text: string): string {
  return String(text ?? "")
    .replace(/\r?\n/g, "\n    ")
    .trim();
}
