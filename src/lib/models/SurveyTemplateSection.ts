import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISurveySectionOpenQuestion {
  enabled: boolean;
  label: string;
}

export interface ISurveyTemplateSection extends Document {
  templateId: string;
  title: string;
  description?: string;
  openQuestion?: ISurveySectionOpenQuestion;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const OpenQuestionSchema = new Schema<ISurveySectionOpenQuestion>(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const SurveyTemplateSectionSchema = new Schema<ISurveyTemplateSection>(
  {
    templateId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    openQuestion: { type: OpenQuestionSchema, default: undefined },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Collection name pinned to legacy value to keep existing data in place.
if (mongoose.models.SurveyTemplateSection) {
  mongoose.deleteModel("SurveyTemplateSection");
}
export const SurveyTemplateSectionModel: Model<ISurveyTemplateSection> =
  mongoose.model<ISurveyTemplateSection>(
    "SurveyTemplateSection",
    SurveyTemplateSectionSchema,
    "archetypesurveytemplatesections"
  );
