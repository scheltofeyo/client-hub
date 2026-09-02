import mongoose, { Schema, Document, Model } from "mongoose";
import type { ICulturalBehavior, ICulturalDnaValue } from "./Client";
import type { ISurveyClosingQuestion } from "./SurveyTemplate";
import type { ISurveyWelcomeScreen } from "@/lib/surveys/welcome-screen";
import type { ISurveySectionOpenQuestion } from "./SurveyTemplateSection";
import type {
  ISurveyQuestionOption,
  IGeneralRankingItem,
  IMultipleChoiceItem,
  ISurveyScaleConfig,
  ISurveyValueItem,
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

/**
 * A cultural value copied from `Client.culturalDna` when the session is created.
 *
 * Deliberately a *copy*, unlike `IArchetypeSnapshot` which stores only an id and
 * resolves name/color live via `enrichArchetypes()`. Archetypes are a global
 * reference collection where a rename should propagate to historical sessions;
 * cultural values are client-owned free text that gets rewritten, and a closed
 * session must not retroactively change the questions people answered.
 */
export type ICulturalValueSnapshot = ICulturalDnaValue;
export type ICulturalBehaviorSnapshot = ICulturalBehavior;

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

  // scale | value-assessment
  scale?: ISurveyScaleConfig;

  // value-assessment
  assessmentPrompt?: string;

  // value-assessment | value-ranking
  valueItems?: ISurveyValueItem[];

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
  /** Copied from `Client.culturalDna` at session creation. Empty for archetype surveys. */
  culturalValues: ICulturalValueSnapshot[];
  /** Copied from `Client.culturalLevels`. Drives the respondent-variable options. */
  culturalLevels: string[];
  /** Custom closing screen copy. Falls back to the built-in translation when unset. */
  thankYouText?: string;
  /** Custom welcome screen copy. Each field falls back to the built-in translation. */
  welcomeScreen?: ISurveyWelcomeScreen;
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
  | "scale-mean"
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

export interface IRespondentVariableOption {
  /**
   * The level string itself, matching `culturalValue.behaviors[].level`. Using the
   * level as its own id keeps that join trivial and mirrors how `Client.culturalDna`
   * already relates behaviours to levels.
   */
  id: string;
  label: string;
  description?: string;
}

/**
 * One attribute captured from the respondent before any question is shown. It both
 * drives per-respondent content (which behaviours a value question renders) and
 * slices the results. Session-level rather than a question type: it must be answered
 * first, must not be reorderable, and the results filter needs it regardless of how
 * the sections are structured.
 */
export interface IRespondentVariable {
  enabled: boolean;
  /** Key under which the answer is stored in `SurveySubmission.cohortTags`. */
  key: string;
  label: string;
  helpText?: string;
  /** Link to material where a respondent can look their level up. */
  helpUrl?: string;
  required: boolean;
  options: IRespondentVariableOption[];
}

export interface ISurveySession extends Document {
  clientId: string;
  /** Empty string means the session was created from scratch (no underlying template). */
  templateId: string;
  templateSnapshot: ISurveyTemplateSnapshot;
  respondentVariable?: IRespondentVariable;
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

const CulturalBehaviorSnapshotSchema = new Schema<ICulturalBehaviorSnapshot>(
  {
    level: { type: String, required: true },
    content: { type: String, default: "" },
  },
  { _id: false }
);

const CulturalValueSnapshotSchema = new Schema<ICulturalValueSnapshot>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    color: { type: String, default: "" },
    mantra: { type: String, default: "" },
    description: { type: String, default: "" },
    behaviors: { type: [CulturalBehaviorSnapshotSchema], default: [] },
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

const ScaleConfigSnapshotSchema = new Schema<ISurveyScaleConfig>(
  {
    min: { type: Number, default: 1 },
    max: { type: Number, default: 5 },
    minLabel: { type: String },
    maxLabel: { type: String },
  },
  { _id: false }
);

const ValueItemSnapshotSchema = new Schema<ISurveyValueItem>(
  {
    id: { type: String, required: true },
    valueId: { type: String, required: true },
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
        "scale",
        "value-assessment",
        "value-ranking",
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

    scale: { type: ScaleConfigSnapshotSchema, default: undefined },
    assessmentPrompt: { type: String },
    valueItems: { type: [ValueItemSnapshotSchema], default: undefined },

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

const WelcomeScreenSnapshotSchema = new Schema<ISurveyWelcomeScreen>(
  {
    tagline: { type: String },
    autoGreeting: { type: Boolean },
    headline: { type: String },
    subheadline: { type: String },
    bodyIntro: { type: String },
    bodyEmail: { type: String },
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
        "scale-mean",
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
    culturalValues: { type: [CulturalValueSnapshotSchema], default: [] },
    culturalLevels: { type: [String], default: [] },
    thankYouText: { type: String },
    welcomeScreen: { type: WelcomeScreenSnapshotSchema, default: undefined },
    rankWeights: { type: [Number], default: [5, 4, 3, 2, 1] },
    top3Weights: { type: [Number], default: [5, 3, 1] },
    closingOpenQuestion: { type: ClosingQuestionSchema, default: undefined },
    sections: { type: [SectionSnapshotSchema], default: [] },
  },
  { _id: false }
);

const RespondentVariableOptionSchema = new Schema<IRespondentVariableOption>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String },
  },
  { _id: false }
);

const RespondentVariableSchema = new Schema<IRespondentVariable>(
  {
    enabled: { type: Boolean, default: false },
    key: { type: String, default: "culturalLevel" },
    label: { type: String, default: "" },
    helpText: { type: String },
    helpUrl: { type: String },
    required: { type: Boolean, default: true },
    options: { type: [RespondentVariableOptionSchema], default: [] },
  },
  { _id: false }
);

const SurveySessionSchema = new Schema<ISurveySession>(
  {
    clientId: { type: String, required: true, index: true },
    templateId: { type: String, default: "" },
    templateSnapshot: { type: TemplateSnapshotSchema, required: true },
    respondentVariable: { type: RespondentVariableSchema, default: undefined },
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
