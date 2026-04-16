import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRankingBehavior {
  level: string;
  content: string;
}

export interface IRankingValue {
  id: string;
  title: string;
  color: string;
  mantra: string;
  description: string;
  behaviors?: IRankingBehavior[];
}

export interface IRankingSession extends Document {
  clientId: string;
  title: string;
  description?: string;
  values: IRankingValue[];
  culturalLevels?: string[];
  showBehaviors?: boolean;
  status: "draft" | "open" | "closed" | "archived";
  shareCode: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const RankingBehaviorSchema = new Schema<IRankingBehavior>(
  {
    level: { type: String, required: true, trim: true },
    content: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const RankingValueSchema = new Schema<IRankingValue>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    mantra: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    behaviors: { type: [RankingBehaviorSchema], default: [] },
  },
  { _id: false }
);

const RankingSessionSchema = new Schema<IRankingSession>(
  {
    clientId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    values: { type: [RankingValueSchema], required: true },
    culturalLevels: { type: [String], default: [] },
    showBehaviors: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "open", "closed", "archived"],
      default: "draft",
    },
    shareCode: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

if (mongoose.models.RankingSession) {
  mongoose.deleteModel("RankingSession");
}
export const RankingSessionModel: Model<IRankingSession> = mongoose.model<IRankingSession>(
  "RankingSession",
  RankingSessionSchema
);
