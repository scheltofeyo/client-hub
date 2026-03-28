import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITemplateTask extends Document {
  templateId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assignToClientLead: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateTaskSchema = new Schema<ITemplateTask>(
  {
    templateId: { type: String, required: true, index: true },
    parentTaskId: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignToClientLead: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.TemplateTask) {
  mongoose.deleteModel("TemplateTask");
}
export const TemplateTaskModel: Model<ITemplateTask> = mongoose.model<ITemplateTask>(
  "TemplateTask",
  TemplateTaskSchema
);
