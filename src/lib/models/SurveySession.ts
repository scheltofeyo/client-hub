import mongoose, { Schema, Document, Model } from "mongoose";
import type { ISurveyClosingQuestion } from "./SurveyTemplate";
import type { ISurveySectionOpenQuestion } from "./SurveyTemplateSection";
import type {
  ISurveyQuestionOption,
  IGeneralRankingItem,
  IMultipleChoiceItem,
  SurveyQuestionType,
} from "./SurveyTemplateQuestion";

export interface IArchetypeSnapshot {
  id: string;
  /**
   * Legacy / fallback fields. New sessions persist `id` only — name and color
   * are resolved live from the Archetype collection at read time so that
   * renames or recolors propagate to historical sessions. Older sessions
   * created before this change still carry the snapshotted values, which
   * are used as fallback if the underlying Archetype doc is missing.
   */
  name?: string;
  color?: string;
  description?: string;
}

export interface ISurveyQuestionSnapshot {
  id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  order: number;

  // archetype-ranking
  options?: ISurveyQuestionOption[];

  // general-ranking
  rankingItems?: IGeneralRankingItem[];

  // multiple-choice
  choiceMode?: "single" | "multi";
  choices?: IMultipleChoiceItem[];
  maxSelections?: number;

  // open-text
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;

  // intro
  bodyHtml?: string;

  // legacy
  openTextEnabled?: boolean;
  openTextLabel?: string;
}

export interface ISurveySectionSnapshot {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  order: number;
  openQuestion?: ISurveySectionOpenQuestion;
  questions: ISurveyQuestionSnapshot[];
}

export interface ISurveyTemplateSnapshot {
  name: string;
  description?: string;
  archetypes: IArchetypeSnapshot[];
  rankWeights: number[];
  top3Weights: number[];
  closingOpenQuestion?: ISurveyClosingQuestion;
  sections: ISurveySectionSnapshot[];
}

export interface ISurveyAnalysisSide {
  id: string;
  label: string;
  questionIds: string[];
}

export type SurveyAnalysisType = "summary" | "comparison";

export type SurveyAnalysisOperation =
  | "mc-average"
  | "mc-pooled"
  | "archetype-points"
  | "ranking-mean"
  | "open-text-frequency"
  | "delta-2"
  | "side-by-side-n"
  | "top-k-overlap"
  | "paired-delta"
  | "convergence";

export interface ISurveyAnalysis {
  id: string;
  rank: number;
  title: string;
  type: SurveyAnalysisType;
  operation: SurveyAnalysisOperation;
  sides: ISurveyAnalysisSide[];
  chartKey?: string;
  capabilityFingerprint?: string;
}

export interface ISurveySession extends Document {
  clientId: string;
  /** Empty string means the session was created from scratch (no underlying template). */
  templateId: string;
  templateSnapshot: ISurveyTemplateSnapshot;
  analyses: ISurveyAnalysis[];
  title: string;
  status: "draft" | "open" | "closed" | "archived";
  shareCode: string;
  createdBy: string;
  // Pinned aggregation pipeline version. Future rounding/weighting fixes
  // must not silently recompute historical sessions — bump only with intent.
  aggregationVersion: string;
  openedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ArchetypeSnapshotSchema = new Schema<IArchetypeSnapshot>(
  {
    id: { type: String, required: true },
    // Legacy fields kept for older sessions; new sessions store id only
    // and resolve name/color live from the Archetype collection.
    name: { type: String },
    color: { type: String },
    description: { type: String },
  },
  { _id: false }
);

const QuestionOptionSchema = new Schema<ISurveyQuestionOption>(
  {
    id: { type: String, required: true },
    archetypeId: { type: String, required: true },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const RankingItemSchema = new Schema<IGeneralRankingItem>(
  {
    id: { type: String, required: true },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const ChoiceSchema = new Schema<IMultipleChoiceItem>(
  {
    id: { type: String, required: true },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const QuestionSnapshotSchema = new Schema<ISurveyQuestionSnapshot>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "archetype-ranking",
        "archetype-top3",
        "general-ranking",
        "general-top3",
        "multiple-choice",
        "open-text",
        "intro",
      ],
      default: "archetype-ranking",
    },
    // Title is optional — intro blocks may be untitled.
    title: { type: String, default: "" },
    description: { type: String },
    order: { type: Number, default: 0 },

    options: { type: [QuestionOptionSchema], default: undefined },
    rankingItems: { type: [RankingItemSchema], default: undefined },

    choiceMode: { type: String, enum: ["single", "multi"] },
    choices: { type: [ChoiceSchema], default: undefined },
    maxSelections: { type: Number },

    placeholder: { type: String },
    multiline: { type: Boolean },
    required: { type: Boolean },

    bodyHtml: { type: String },

    openTextEnabled: { type: Boolean },
    openTextLabel: { type: String },
  },
  { _id: false }
);

const SectionOpenQuestionSchema = new Schema<ISurveySectionOpenQuestion>(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const SectionSnapshotSchema = new Schema<ISurveySectionSnapshot>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    order: { type: Number, default: 0 },
    openQuestion: { type: SectionOpenQuestionSchema, default: undefined },
    questions: { type: [QuestionSnapshotSchema], default: [] },
  },
  { _id: false }
);

const ClosingQuestionSchema = new Schema<ISurveyClosingQuestion>(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const AnalysisSideSchema = new Schema<ISurveyAnalysisSide>(
  {
    id: { type: String, required: true },
    label: { type: String, default: "" },
    questionIds: { type: [String], default: [] },
  },
  { _id: false }
);

const AnalysisSchema = new Schema<ISurveyAnalysis>(
  {
    id: { type: String, required: true },
    rank: { type: Number, default: 0 },
    title: { type: String, default: "" },
    type: {
      type: String,
      enum: ["summary", "comparison"],
      required: true,
    },
    operation: {
      type: String,
      enum: [
        "mc-average",
        "mc-pooled",
        "archetype-points",
        "ranking-mean",
        "open-text-frequency",
        "delta-2",
        "side-by-side-n",
        "top-k-overlap",
        "paired-delta",
        "convergence",
      ],
      required: true,
    },
    sides: { type: [AnalysisSideSchema], default: [] },
    chartKey: { type: String },
    capabilityFingerprint: { type: String },
  },
  { _id: false }
);

const TemplateSnapshotSchema = new Schema<ISurveyTemplateSnapshot>(
  {
    name: { type: String, required: true },
    description: { type: String },
    archetypes: { type: [ArchetypeSnapshotSchema], default: [] },
    rankWeights: { type: [Number], default: [5, 4, 3, 2, 1] },
    top3Weights: { type: [Number], default: [5, 3, 1] },
    closingOpenQuestion: { type: ClosingQuestionSchema, default: undefined },
    sections: { type: [SectionSnapshotSchema], default: [] },
  },
  { _id: false }
);

const SurveySessionSchema = new Schema<ISurveySession>(
  {
    clientId: { type: String, required: true, index: true },
    templateId: { type: String, default: "" },
    templateSnapshot: { type: TemplateSnapshotSchema, required: true },
    analyses: { type: [AnalysisSchema], default: [] },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "open", "closed", "archived"],
      default: "draft",
    },
    shareCode: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
    aggregationVersion: { type: String, default: "v1" },
    openedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// Collection name pinned to legacy value to keep existing data in place.
if (mongoose.models.SurveySession) {
  mongoose.deleteModel("SurveySession");
}
export const SurveySessionModel: Model<ISurveySession> =
  mongoose.model<ISurveySession>(
    "SurveySession",
    SurveySessionSchema,
    "archetypesurveysessions"
  );
