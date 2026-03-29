import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILog extends Document {
  clientId: string;
  contactId?: string; // legacy — superseded by contactIds
  contactIds: string[];
  date: string;
  summary: string;
  signalIds: string[];
  followUp: boolean;
  followUpAction?: string;
  followUpDeadline?: string;
  followUpTaskId?: string;
  followedUpAt?: string;
  followedUpByName?: string;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const LogSchema = new Schema<ILog>(
  {
    clientId: { type: String, required: true, index: true },
    contactId: { type: String }, // legacy
    contactIds: { type: [String], default: [] },
    date: { type: String, required: true },
    summary: { type: String, required: true, trim: true },
    signalIds: { type: [String], default: [] },
    followUp: { type: Boolean, default: false },
    followUpAction: { type: String },
    followUpDeadline: { type: String },
    followUpTaskId: { type: String },
    followedUpAt: { type: String },
    followedUpByName: { type: String },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

if (mongoose.models.Log) {
  mongoose.deleteModel("Log");
}
export const LogModel: Model<ILog> = mongoose.model<ILog>("Log", LogSchema);
