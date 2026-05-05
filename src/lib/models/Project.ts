import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProject extends Document {
  clientId: string;
  title: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed";
  completedDate?: string;
  deliveryDate?: string;
  soldPrice?: number;
  templateId?: string;
  serviceId?: string;
  labelId?: string;
  kickedOffAt?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  members?: { userId: string; name: string; image?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    clientId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
      index: true,
    },
    completedDate: { type: String, trim: true, index: true },
    deliveryDate: { type: String, trim: true, index: true },
    soldPrice: { type: Number },
    templateId: { type: String },
    serviceId: { type: String },
    labelId: { type: String },
    kickedOffAt: { type: String, trim: true },
    scheduledStartDate: { type: String, trim: true, index: true },
    scheduledEndDate: { type: String, trim: true },
    members: {
      type: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          image: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

ProjectSchema.index({ "members.userId": 1 });

if (mongoose.models.Project) {
  mongoose.deleteModel("Project");
}
export const ProjectModel: Model<IProject> = mongoose.model<IProject>("Project", ProjectSchema);
