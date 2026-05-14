import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  ISurveyComparison,
  ISurveyClosingQuestion,
} from "./SurveyTemplate";
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
  order: number;
  openQuestion?: ISurveySectionOpenQuestion;
  questions: ISurveyQuestionSnapshot[];
}

export interface ISurveyTemplateSnapshot {
  name: string;
  description?: string;
  archetypes: IArchetypeSnapshot[];
  rankWeights: number[];
  closingOpenQuestion?: ISurveyClosingQuestion;
  sections: ISurveySectionSnapshot[];
  comparisons: ISurveyComparison[];
}

export interface ISurveySession extends Document {
  clientId: string;
  /** Empty string means the session was created from scratch (no underlying template). */
  templateId: string;
  templateSnapshot: ISurveyTemplateSnapshot;
  sessionComparisons: ISurveyComparison[];
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
      enum: ["archetype-ranking", "general-ranking", "multiple-choice", "open-text", "intro"],
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

const ComparisonSchema = new Schema<ISurveyComparison>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    leftLabel: { type: String, required: true },
    rightLabel: { type: String, required: true },
    leftQuestionIds: { type: [String], default: [] },
    rightQuestionIds: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const TemplateSnapshotSchema = new Schema<ISurveyTemplateSnapshot>(
  {
    name: { type: String, required: true },
    description: { type: String },
    archetypes: { type: [ArchetypeSnapshotSchema], default: [] },
    rankWeights: { type: [Number], default: [5, 4, 3, 2, 1] },
    closingOpenQuestion: { type: ClosingQuestionSchema, default: undefined },
    sections: { type: [SectionSnapshotSchema], default: [] },
    comparisons: { type: [ComparisonSchema], default: [] },
  },
  { _id: false }
);

const SurveySessionSchema = new Schema<ISurveySession>(
  {
    clientId: { type: String, required: true, index: true },
    templateId: { type: String, default: "" },
    templateSnapshot: { type: TemplateSnapshotSchema, required: true },
    sessionComparisons: { type: [ComparisonSchema], default: [] },
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
