import mongoose, { Schema, Document, Model } from "mongoose";
import type { ISurveyWelcomeScreen } from "@/lib/surveys/welcome-screen";
import type { ISurveyClosingScreen } from "@/lib/surveys/closing-screen";

export interface ISurveyClosingQuestion {
  enabled: boolean;
  label: string;
}

/**
 * Template-level copy for the respondent-variable step. The *options* are never
 * stored here — they come from the client's `culturalLevels` at session creation,
 * which is what lets one template serve every client.
 */
export interface ISurveyRespondentVariableDefaults {
  enabled: boolean;
  key: string;
  label: string;
  helpText?: string;
  helpUrl?: string;
  required: boolean;
}

export interface ISurveyTemplate extends Document {
  name: string;
  description?: string;
  status: "active" | "archived";
  archetypeIds: string[];
  defaultRankWeights: number[];
  defaultTop3Weights: number[];
  closingOpenQuestion?: ISurveyClosingQuestion;
  defaultThankYouText?: string;
  defaultWelcomeScreen?: ISurveyWelcomeScreen;
  defaultClosingScreen?: ISurveyClosingScreen;
  defaultRespondentVariable?: ISurveyRespondentVariableDefaults;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClosingOpenQuestionSchema = new Schema<ISurveyClosingQuestion>(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/**
 * Every field is optional and empty means "use the built-in translation", so a
 * template that never touches this keeps the bilingual default welcome screen.
 */
const WelcomeScreenSchema = new Schema<ISurveyWelcomeScreen>(
  {
    tagline: { type: String, trim: true },
    autoGreeting: { type: Boolean },
    headline: { type: String, trim: true },
    subheadline: { type: String, trim: true },
    bodyIntro: { type: String, trim: true },
    bodyEmail: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Same override semantics as the welcome screen: empty means "use the built-in
 * translation". `defaultThankYouText` is the field this supersedes and is kept
 * as the body's fallback, so seeded templates keep their closing message.
 */
const ClosingScreenSchema = new Schema<ISurveyClosingScreen>(
  {
    headline: { type: String, trim: true },
    body: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
  },
  { _id: false }
);

const RespondentVariableDefaultsSchema = new Schema<ISurveyRespondentVariableDefaults>(
  {
    enabled: { type: Boolean, default: false },
    key: { type: String, trim: true, default: "culturalLevel" },
    label: { type: String, trim: true, default: "" },
    helpText: { type: String, trim: true },
    helpUrl: { type: String, trim: true },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const SurveyTemplateSchema = new Schema<ISurveyTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    archetypeIds: { type: [String], default: [] },
    defaultRankWeights: { type: [Number], default: [5, 4, 3, 2, 1] },
    defaultTop3Weights: { type: [Number], default: [5, 3, 1] },
    closingOpenQuestion: { type: ClosingOpenQuestionSchema, default: undefined },
    defaultThankYouText: { type: String, trim: true },
    defaultWelcomeScreen: { type: WelcomeScreenSchema, default: undefined },
    defaultClosingScreen: { type: ClosingScreenSchema, default: undefined },
    defaultRespondentVariable: { type: RespondentVariableDefaultsSchema, default: undefined },
    version: { type: Number, default: 1 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Collection name pinned to legacy value to keep existing data in place.
if (mongoose.models.SurveyTemplate) {
  mongoose.deleteModel("SurveyTemplate");
}
export const SurveyTemplateModel: Model<ISurveyTemplate> = mongoose.model<ISurveyTemplate>(
  "SurveyTemplate",
  SurveyTemplateSchema,
  "archetypesurveytemplates"
);
