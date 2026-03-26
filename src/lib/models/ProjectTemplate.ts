import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProjectTemplate extends Document {
  name: string;
  description?: string;
  defaultDescription?: string;
  defaultSoldPrice?: number;
  defaultServiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    defaultDescription: { type: String, trim: true },
    defaultSoldPrice: { type: Number },
    defaultServiceId: { type: String },
  },
  { timestamps: true }
);

if (mongoose.models.ProjectTemplate) {
  mongoose.deleteModel("ProjectTemplate");
}
export const ProjectTemplateModel: Model<IProjectTemplate> = mongoose.model<IProjectTemplate>(
  "ProjectTemplate",
  ProjectTemplateSchema
);
