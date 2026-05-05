import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProjectTemplate extends Document {
  name: string;
  summary?: string;
  defaultDescription?: string;
  defaultSoldPrice?: number;
  defaultServiceId?: string;
  defaultDeliveryDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    defaultDescription: { type: String, trim: true },
    defaultSoldPrice: { type: Number },
    defaultServiceId: { type: String },
    defaultDeliveryDays: { type: Number },
  },
  { timestamps: true, strict: false }
);

if (mongoose.models.ProjectTemplate) {
  mongoose.deleteModel("ProjectTemplate");
}
export const ProjectTemplateModel: Model<IProjectTemplate> = mongoose.model<IProjectTemplate>(
  "ProjectTemplate",
  ProjectTemplateSchema
);
