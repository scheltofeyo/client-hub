import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProjectTemplate extends Document {
  name: string;
  description?: string;
  defaultDescription?: string;
  defaultSoldPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    defaultDescription: { type: String, trim: true },
    defaultSoldPrice: { type: Number },
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
