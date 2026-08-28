import mongoose, { Schema, Document, Model } from "mongoose";

export type SurveyQuestionType =
  | "archetype-ranking"
  | "archetype-top3"
  | "general-ranking"
  | "general-top3"
  | "multiple-choice"
  | "open-text"
  | "scale"
  | "value-assessment"
  | "value-ranking"
  | "intro";

/** Likert-style numeric scale. Shared by `scale` and `value-assessment`. */
export interface ISurveyScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

/**
 * One cultural value inside a value-backed question.
 *
 * Never authored in a template — materialised at session creation from the
 * client's `culturalDna`. That is precisely what lets one template serve every
 * client regardless of how many values they have.
 */
export interface ISurveyValueItem {
  id: string;
  /** References `templateSnapshot.culturalValues[].id`. */
  valueId: string;
}

export interface ISurveyQuestionOption {
  id: string;
  archetypeId: string;
  text: string;
}

export interface IGeneralRankingItem {
  id: string;
  text: string;
}

export interface IMultipleChoiceItem {
  id: string;
  text: string;
}

export interface ISurveyTemplateQuestion extends Document {
  templateId: string;
  sectionId: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  order: number;

  // type === "archetype-ranking"
  options: ISurveyQuestionOption[];

  // type === "general-ranking"
  rankingItems: IGeneralRankingItem[];

  // type === "multiple-choice"
  choiceMode?: "single" | "multi";
  choices: IMultipleChoiceItem[];
  maxSelections?: number;

  // type === "open-text"
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;

  // type === "scale" | "value-assessment"
  scale?: ISurveyScaleConfig;

  // type === "value-assessment" — the Likert prompt repeated for every value
  assessmentPrompt?: string;

  // type === "value-assessment" | "value-ranking" — filled at session creation
  valueItems: ISurveyValueItem[];

  // type === "intro"
  bodyHtml?: string;

  // legacy (pre-migration) — kept for backwards-compatibility reads
  openTextEnabled?: boolean;
  openTextLabel?: string;

  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<ISurveyQuestionOption>(
  {
    id: { type: String, required: true },
    archetypeId: { type: String, required: true },
    text: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const RankingItemSchema = new Schema<IGeneralRankingItem>(
  {
    id: { type: String, required: true },
    text: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const ChoiceSchema = new Schema<IMultipleChoiceItem>(
  {
    id: { type: String, required: true },
    text: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const ScaleConfigSchema = new Schema<ISurveyScaleConfig>(
  {
    min: { type: Number, default: 1 },
    max: { type: Number, default: 5 },
    minLabel: { type: String, trim: true },
    maxLabel: { type: String, trim: true },
  },
  { _id: false }
);

const ValueItemSchema = new Schema<ISurveyValueItem>(
  {
    id: { type: String, required: true },
    valueId: { type: String, required: true },
  },
  { _id: false }
);

const SurveyTemplateQuestionSchema = new Schema<ISurveyTemplateQuestion>(
  {
    templateId: { type: String, required: true, index: true },
    sectionId: { type: String, required: true, index: true },
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
    // Title is optional at schema level — intro blocks may be untitled.
    // Per-type required-ness is enforced in src/lib/surveys/question-validation.ts.
    title: { type: String, default: "", trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 },

    options: { type: [OptionSchema], default: [] },
    rankingItems: { type: [RankingItemSchema], default: [] },

    choiceMode: { type: String, enum: ["single", "multi"] },
    choices: { type: [ChoiceSchema], default: [] },
    maxSelections: { type: Number },

    placeholder: { type: String, trim: true },
    multiline: { type: Boolean },
    required: { type: Boolean },

    scale: { type: ScaleConfigSchema, default: undefined },
    assessmentPrompt: { type: String, trim: true },
    valueItems: { type: [ValueItemSchema], default: [] },

    bodyHtml: { type: String },

    openTextEnabled: { type: Boolean },
    openTextLabel: { type: String, trim: true },
  },
  { timestamps: true }
);

// Collection name pinned to legacy value to keep existing data in place.
if (mongoose.models.SurveyTemplateQuestion) {
  mongoose.deleteModel("SurveyTemplateQuestion");
}
export const SurveyTemplateQuestionModel: Model<ISurveyTemplateQuestion> =
  mongoose.model<ISurveyTemplateQuestion>(
    "SurveyTemplateQuestion",
    SurveyTemplateQuestionSchema,
    "archetypesurveytemplatequestions"
  );
