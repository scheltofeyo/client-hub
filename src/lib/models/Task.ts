import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITask extends Document {
  clientId?: string;
  projectId?: string;
  parentTaskId?: string;
  logId?: string;
  title: string;
  description?: string;
  assignees: { userId: string; name: string; image?: string }[];
  completionDate?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  order: number;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    clientId: { type: String, index: true },
    projectId: { type: String, index: true },
    parentTaskId: { type: String, index: true },
    logId: { type: String, index: true },
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
    completionDate: { type: String, index: true },
    completedAt: { type: String, index: true },
    completedById: { type: String },
    completedByName: { type: String },
    order: { type: Number, default: 0 },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

TaskSchema.index({ "assignees.userId": 1 });

if (mongoose.models.Task) {
  mongoose.deleteModel("Task");
}
export const TaskModel: Model<ITask> = mongoose.model<ITask>("Task", TaskSchema);
