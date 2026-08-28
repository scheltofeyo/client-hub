// Shared client-side types for the survey results API response.
// Mirrors `src/app/api/surveys/sessions/[id]/results/route.ts`.

import type { SurveyQuestionType } from "@/lib/surveys/types";
import type { AnalysisResult } from "@/lib/surveys/analyses";

export interface ResultsArchetype {
  id: string;
  name: string;
  color: string;
}

export interface ResultsCapabilities {
  hasArchetypeRanking: boolean;
  hasGeneralRanking: boolean;
  hasArchetypeTop3: boolean;
  hasGeneralTop3: boolean;
  hasMultipleChoice: boolean;
  hasOpenText: boolean;
  hasScale: boolean;
  hasValueAssessment: boolean;
  hasValueRanking: boolean;
  hasAnalyses: boolean;
}

export interface ResultsCulturalValue {
  id: string;
  title: string;
  color: string;
  mantra?: string;
}

/** One respondent segment (e.g. a Cultural Level) available on the results view. */
export interface ResultsSegment {
  value: string;
  label: string;
  n: number;
  /** False only when the segment has no responses yet — nothing to filter to. */
  selectable: boolean;
}

export interface OpenAnswer {
  text: string;
}

export interface SectionResult {
  sectionId: string;
  title: string;
  archetypes: { archetypeId: string; percentage: number }[];
  n: number;
  agreement: number | null;
  openAnswers: OpenAnswer[];
}

interface QuestionBase {
  questionId: string;
  title: string;
  sectionId: string;
  n: number;
  lowConfidence: boolean;
  agreement: number | null;
}

export type QuestionResult =
  | (QuestionBase & {
      type: "archetype-ranking" | "archetype-top3";
      archetypes: { archetypeId: string; percentage: number; points: number }[];
      totalPoints: number;
      rankDistribution: Record<string, number[]>;
      openTextAnswers: OpenAnswer[];
    })
  | (QuestionBase & {
      type: "general-ranking" | "general-top3";
      items: {
        itemId: string;
        text: string;
        averageRank: number;
        distribution: number[];
        points: number;
        percentage: number;
      }[];
      totalPoints: number;
    })
  | (QuestionBase & {
      type: "multiple-choice";
      choiceMode: "single" | "multi";
      distribution: { choiceId: string; text: string; count: number; percentage: number }[];
    })
  | (QuestionBase & {
      type: "scale";
      min: number;
      max: number;
      mean: number | null;
      sd: number | null;
      distribution: number[];
    })
  | (QuestionBase & {
      type: "value-assessment";
      min: number;
      max: number;
      values: {
        valueItemId: string;
        valueId: string;
        title: string;
        color: string;
        n: number;
        mean: number | null;
        sd: number | null;
        distribution: number[];
      }[];
    })
  | (QuestionBase & {
      type: "value-ranking";
      values: {
        valueItemId: string;
        valueId: string;
        title: string;
        color: string;
        meanRank: number | null;
        distribution: number[];
      }[];
    })
  | (QuestionBase & { type: "open-text"; answers: OpenAnswer[] })
  | (QuestionBase & { type: "intro" });

export interface ResultsData {
  participantCount: number;
  archetypes: ResultsArchetype[];
  culturalValues: ResultsCulturalValue[];
  /** Every segment present in the data, including suppressed ones. */
  segments: ResultsSegment[];
  /** The segment this payload is filtered to, or null for the whole group. */
  activeSegment: string | null;
  segmentLabel: string | null;
  capabilities: ResultsCapabilities;
  overall: {
    archetypes: { archetypeId: string; percentage: number }[];
    n: number;
    agreement: number | null;
  };
  perSection: SectionResult[];
  perQuestion: QuestionResult[];
  analyses: AnalysisResult[];
  closingOpenAnswers: OpenAnswer[];
}

export type { SurveyQuestionType, AnalysisResult };
