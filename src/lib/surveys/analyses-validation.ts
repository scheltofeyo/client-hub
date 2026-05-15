import type { ISurveySession } from "@/lib/models/SurveySession";
import { normalizeQuestionType } from "./types";
import type { QuestionMeta } from "./distributions";
import {
  type AnalysisOperation,
  type AnalysisSide,
  type AnalysisType,
  COMPARISON_OPERATIONS,
  OP_QUESTION_TYPES,
  SUMMARY_OPERATIONS,
  computeCapabilityFingerprint,
  questionSchemaKey,
} from "./analyses";

const MAX_COMPARISON_SIDES = 4;

export interface AnalysisInput {
  id?: string;
  title?: unknown;
  type?: unknown;
  operation?: unknown;
  sides?: unknown;
  chartKey?: unknown;
}

export interface ValidatedAnalysis {
  id: string;
  rank: number;
  title: string;
  type: AnalysisType;
  operation: AnalysisOperation;
  sides: AnalysisSide[];
  chartKey?: string;
  capabilityFingerprint: string;
}

export type ValidationResult =
  | { ok: true; analysis: ValidatedAnalysis }
  | { ok: false; error: string };

function questionMetasFromSession(session: Pick<ISurveySession, "templateSnapshot">): QuestionMeta[] {
  const out: QuestionMeta[] = [];
  for (const s of session.templateSnapshot?.sections ?? []) {
    for (const q of s.questions ?? []) {
      // q can arrive as a Mongoose subdocument when the caller didn't .lean()
      // the parent query — spread (`...q`) on a Mongoose subdoc doesn't reliably
      // copy schema-stored fields, which dropped the `id` field and broke the
      // metaMap lookup. Force a plain-object snapshot first.
      const plain = (typeof (q as { toObject?: () => unknown }).toObject === "function"
        ? ((q as unknown) as { toObject: () => unknown }).toObject()
        : q) as QuestionMeta;
      out.push({ ...plain, sectionId: s.id, type: normalizeQuestionType(plain.type) });
    }
  }
  return out;
}

export function validateAnalysisInput(
  input: AnalysisInput,
  session: Pick<ISurveySession, "templateSnapshot">,
  existingId?: string,
  rank?: number
): ValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required" };

  const type = input.type;
  if (type !== "summary" && type !== "comparison") {
    return { ok: false, error: "Type must be 'summary' or 'comparison'" };
  }

  const op = input.operation;
  const validOpsForType = type === "summary" ? SUMMARY_OPERATIONS : COMPARISON_OPERATIONS;
  if (typeof op !== "string" || !validOpsForType.includes(op as AnalysisOperation)) {
    return { ok: false, error: `Operation must be one of ${validOpsForType.join(", ")}` };
  }
  const operation = op as AnalysisOperation;

  if (!Array.isArray(input.sides)) {
    return { ok: false, error: "Sides must be an array" };
  }
  if (type === "summary" && input.sides.length !== 1) {
    return { ok: false, error: "Summary needs exactly one side" };
  }
  if (type === "comparison") {
    if (input.sides.length < 2) {
      return { ok: false, error: "Comparison needs at least two sides" };
    }
    if (input.sides.length > MAX_COMPARISON_SIDES) {
      return { ok: false, error: `Up to ${MAX_COMPARISON_SIDES} sides` };
    }
  }

  const questionMetas = questionMetasFromSession(session);
  const metaMap = new Map(questionMetas.map((q) => [q.id, q]));
  const allowedTypes = OP_QUESTION_TYPES[operation];

  const sides: AnalysisSide[] = [];
  for (let i = 0; i < input.sides.length; i++) {
    const raw = input.sides[i] as Record<string, unknown>;
    const sideLabel = typeof raw.label === "string" ? raw.label : "";
    const sideId = typeof raw.id === "string" && raw.id ? raw.id : `s-${i}-${randomId()}`;
    const questionIds = Array.isArray(raw.questionIds) ? raw.questionIds.filter((x): x is string => typeof x === "string") : [];
    if (questionIds.length === 0) {
      return { ok: false, error: `Side "${sideLabel || i}" needs at least one question` };
    }
    for (const qid of questionIds) {
      const qm = metaMap.get(qid);
      if (!qm) return { ok: false, error: `Question ${qid} not found in this survey` };
      if (!allowedTypes.includes(qm.type)) {
        return { ok: false, error: `Question "${qm.title || qid}" is not compatible with this operation` };
      }
    }
    sides.push({ id: sideId, label: sideLabel, questionIds });
  }

  // Schema-key consistency across all selected questions in all sides.
  const allQids = sides.flatMap((s) => s.questionIds);
  const schemas = new Set(allQids.map((qid) => questionSchemaKey(metaMap.get(qid)!)));
  if (schemas.size > 1) {
    return { ok: false, error: "All selected questions must share the same answer structure" };
  }

  const capabilityFingerprint = computeCapabilityFingerprint(allQids, questionMetas);
  const chartKey = typeof input.chartKey === "string" ? input.chartKey : undefined;

  return {
    ok: true,
    analysis: {
      id: existingId ?? input.id ?? randomId(),
      rank: rank ?? 0,
      title,
      type,
      operation,
      sides,
      chartKey,
      capabilityFingerprint,
    },
  };
}

function randomId(): string {
  return `a-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
