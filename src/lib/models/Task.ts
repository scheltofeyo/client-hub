import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITask extends Document {
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assignees: { userId: string; name: string; image?: string }[];
  completionDate?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    projectId: { type: String, required: true, index: true },
    parentTaskId: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignees: {
      type: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          image: { type: String },
        },
      ],
      default: [],
    },
    completionDate: { type: String },
    completedAt: { type: String },
    completedById: { type: String },
    completedByName: { type: String },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

if (mongoose.models.Task) {
  mongoose.deleteModel("Task");
}
export const TaskModel: Model<ITask> = mongoose.model<ITask>("Task", TaskSchema);
