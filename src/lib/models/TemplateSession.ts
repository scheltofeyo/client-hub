import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITemplateSession extends Document {
  templateId: string;
  title: string;
  info?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSessionSchema = new Schema<ITemplateSession>(
  {
    templateId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    info: { type: String, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.TemplateSession) {
  mongoose.deleteModel("TemplateSession");
}
export const TemplateSessionModel: Model<ITemplateSession> = mongoose.model<ITemplateSession>(
  "TemplateSession",
  TemplateSessionSchema
);
