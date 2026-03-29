import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProjectLabel extends Document {
  name: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectLabelSchema = new Schema<IProjectLabel>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    rank: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.ProjectLabel) {
  mongoose.deleteModel("ProjectLabel");
}
export const ProjectLabelModel: Model<IProjectLabel> = mongoose.model<IProjectLabel>(
  "ProjectLabel",
  ProjectLabelSchema
);
