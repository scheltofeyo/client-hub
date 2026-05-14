import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISurveyComparison {
  id: string;
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftQuestionIds: string[];
  rightQuestionIds: string[];
  order: number;
}

export interface ISurveyClosingQuestion {
  enabled: boolean;
  label: string;
}

export interface ISurveyTemplate extends Document {
  name: string;
  description?: string;
  status: "active" | "archived";
  archetypeIds: string[];
  defaultRankWeights: number[];
  closingOpenQuestion?: ISurveyClosingQuestion;
  comparisons: ISurveyComparison[];
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComparisonSchema = new Schema<ISurveyComparison>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    leftLabel: { type: String, required: true, trim: true },
    rightLabel: { type: String, required: true, trim: true },
    leftQuestionIds: { type: [String], default: [] },
    rightQuestionIds: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const ClosingOpenQuestionSchema = new Schema<ISurveyClosingQuestion>(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, trim: true, default: "" },
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
    closingOpenQuestion: { type: ClosingOpenQuestionSchema, default: undefined },
    comparisons: { type: [ComparisonSchema], default: [] },
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
