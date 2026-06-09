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
  hasAnalyses: boolean;
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
  | (QuestionBase & { type: "open-text"; answers: OpenAnswer[] })
  | (QuestionBase & { type: "intro" });

export interface ResultsData {
  participantCount: number;
  archetypes: ResultsArchetype[];
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
