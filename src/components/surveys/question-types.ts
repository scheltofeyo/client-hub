import {
  ArrowDownUp,
  FileText,
  Gauge,
  Heart,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { SurveyQuestionType } from "@/lib/surveys/types";

export const QUESTION_TYPE_META: Record<
  SurveyQuestionType,
  { label: string; icon: LucideIcon; color: string }
> = {
  "archetype-ranking": { label: "Archetype ranking", icon: LayoutGrid, color: "var(--primary)" },
  "archetype-top3": { label: "Archetype top 3", icon: Trophy, color: "var(--primary)" },
  "general-ranking": { label: "General ranking", icon: ArrowDownUp, color: "var(--info)" },
  "general-top3": { label: "General top 3", icon: Trophy, color: "var(--info)" },
  "multiple-choice": { label: "Multiple choice", icon: ListChecks, color: "var(--info)" },
  "open-text": { label: "Open text", icon: MessageSquare, color: "var(--text-muted)" },
  scale: { label: "Scale", icon: Gauge, color: "var(--info)" },
  "value-assessment": { label: "Value assessment", icon: Sparkles, color: "var(--primary)" },
  "value-ranking": { label: "Value ranking", icon: Heart, color: "var(--primary)" },
  intro: { label: "Info block", icon: FileText, color: "var(--text-muted)" },
};

export interface ShellQuestionBase {
  id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
}

export interface ShellArchetypeRanking extends ShellQuestionBase {
  type: "archetype-ranking";
  options: { id: string; archetypeId: string; text: string }[];
  required?: boolean;
}

export interface ShellArchetypeTop3 extends ShellQuestionBase {
  type: "archetype-top3";
  options: { id: string; archetypeId: string; text: string }[];
  required?: boolean;
}

export interface ShellGeneralRanking extends ShellQuestionBase {
  type: "general-ranking";
  rankingItems: { id: string; text: string }[];
  required?: boolean;
}

export interface ShellGeneralTop3 extends ShellQuestionBase {
  type: "general-top3";
  rankingItems: { id: string; text: string }[];
  required?: boolean;
}

export interface ShellMultipleChoice extends ShellQuestionBase {
  type: "multiple-choice";
  choiceMode: "single" | "multi";
  choices: { id: string; text: string }[];
  maxSelections?: number;
  required?: boolean;
}

export interface ShellOpenText extends ShellQuestionBase {
  type: "open-text";
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}

export interface ShellScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface ShellValueItem {
  id: string;
  valueId: string;
}

export interface ShellScale extends ShellQuestionBase {
  type: "scale";
  scale?: ShellScaleConfig;
  required?: boolean;
}

export interface ShellValueAssessment extends ShellQuestionBase {
  type: "value-assessment";
  scale?: ShellScaleConfig;
  assessmentPrompt?: string;
  /** Materialised from the client's DNA — read-only in the editor. */
  valueItems?: ShellValueItem[];
  required?: boolean;
}

export interface ShellValueRanking extends ShellQuestionBase {
  type: "value-ranking";
  valueItems?: ShellValueItem[];
  required?: boolean;
}

export interface ShellIntro extends ShellQuestionBase {
  type: "intro";
  bodyHtml?: string;
}

export type ShellQuestionAny =
  | ShellArchetypeRanking
  | ShellArchetypeTop3
  | ShellGeneralRanking
  | ShellGeneralTop3
  | ShellMultipleChoice
  | ShellOpenText
  | ShellScale
  | ShellValueAssessment
  | ShellValueRanking
  | ShellIntro;
