import {
  ArrowDownUp,
  FileText,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { SurveyQuestionType } from "@/lib/surveys/types";

export const QUESTION_TYPE_META: Record<
  SurveyQuestionType,
  { label: string; icon: LucideIcon; color: string }
> = {
  "archetype-ranking": { label: "Archetype ranking", icon: LayoutGrid, color: "var(--primary)" },
  "general-ranking": { label: "General ranking", icon: ArrowDownUp, color: "var(--info)" },
  "multiple-choice": { label: "Multiple choice", icon: ListChecks, color: "var(--info)" },
  "open-text": { label: "Open text", icon: MessageSquare, color: "var(--text-muted)" },
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

export interface ShellGeneralRanking extends ShellQuestionBase {
  type: "general-ranking";
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

export interface ShellIntro extends ShellQuestionBase {
  type: "intro";
  bodyHtml?: string;
}

export type ShellQuestionAny =
  | ShellArchetypeRanking
  | ShellGeneralRanking
  | ShellMultipleChoice
  | ShellOpenText
  | ShellIntro;
