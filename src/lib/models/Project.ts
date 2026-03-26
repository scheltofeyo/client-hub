import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProject extends Document {
  clientId: string;
  title: string;
  description?: string;
  status: "planning" | "in_progress" | "review" | "completed" | "on_hold";
  deliveryDate?: string;
  soldPrice?: number;
  templateId?: string;
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
      enum: ["planning", "in_progress", "review", "completed", "on_hold"],
      default: "planning",
    },
    deliveryDate: { type: String, trim: true },
    soldPrice: { type: Number },
    templateId: { type: String },
  },
  { timestamps: true }
);

if (mongoose.models.Project) {
  mongoose.deleteModel("Project");
}
export const ProjectModel: Model<IProject> = mongoose.model<IProject>("Project", ProjectSchema);
