import type { QuestionResult } from "./types";

const TYPE_NOUN: Record<string, string> = {
  "multiple-choice": "multiple-choice questions",
  "archetype-ranking": "archetype-ranking questions",
  "archetype-top3": "archetype top-3 questions",
  "general-ranking": "ranking questions",
  "general-top3": "top-3 questions",
  "open-text": "open-text questions",
};

interface AnalysisConfigForDescription {
  type: "summary" | "comparison";
  operation: string;
  sides: { label: string; questionIds: string[] }[];
}

export function describeAnalysisFromConfig(
  analysis: AnalysisConfigForDescription,
  questionsById: Map<string, { title: string; type: QuestionResult["type"] }>
): string {
  const allIds = analysis.sides.flatMap((s) => s.questionIds);
  const totalQuestions = allIds.length;
  const firstQ = allIds.map((id) => questionsById.get(id)).find(Boolean);
  const typeNoun = firstQ ? TYPE_NOUN[firstQ.type] ?? "questions" : "questions";

  if (analysis.type === "summary") {
    const titles = allIds.slice(0, 2).map((id) => questionsById.get(id)?.title).filter((t): t is string => !!t);
    const remainder = totalQuestions - titles.length;
    const titleList = titles.length === 0
      ? ""
      : ` (${titles.join(", ")}${remainder > 0 ? ` and ${remainder} more` : ""})`;
    return `${operationVerb(analysis.operation)} of ${totalQuestions} ${typeNoun}${titleList}`;
  }

  const sideCount = analysis.sides.length;
  if (sideCount === 2) {
    return `Delta between ${analysis.sides[0].label || "Side A"} and ${analysis.sides[1].label || "Side B"} across ${totalQuestions} ${typeNoun}`;
  }
  return `${sideCount}-way comparison across ${totalQuestions} ${typeNoun}`;
}

function operationVerb(operation: string): string {
  switch (operation) {
    case "mc-average":
    case "mc-pooled":
      return "Average";
    case "archetype-points":
      return "Sum";
    case "ranking-mean":
      return "Mean rank";
    case "open-text-frequency":
      return "Term frequency";
    default:
      return "Summary";
  }
}
