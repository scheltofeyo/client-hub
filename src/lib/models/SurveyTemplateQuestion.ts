import mongoose, { Schema, Document, Model } from "mongoose";

export type SurveyQuestionType =
  | "archetype-ranking"
  | "archetype-top3"
  | "general-ranking"
  | "general-top3"
  | "multiple-choice"
  | "open-text"
  | "intro";

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
