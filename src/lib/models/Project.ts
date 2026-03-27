import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProject extends Document {
  clientId: string;
  title: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed";
  completedDate?: string;
  soldPrice?: number;
  templateId?: string;
  serviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    clientId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    completedDate: { type: String, trim: true },
    soldPrice: { type: Number },
    templateId: { type: String },
    serviceId: { type: String },
  },
  { timestamps: true }
);

if (mongoose.models.Project) {
  mongoose.deleteModel("Project");
}
export const ProjectModel: Model<IProject> = mongoose.model<IProject>("Project", ProjectSchema);
