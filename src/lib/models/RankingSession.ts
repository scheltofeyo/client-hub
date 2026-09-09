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

export interface IRankingMatchPair {
  participant1Id: string;
  participant2Id: string;
  opposition: number;
}

/**
 * The pairing, frozen at the moment the session closed.
 *
 * Recomputing it on every read is what let the admin overview and the
 * participant results page disagree, and it would also let a late submission
 * silently reshuffle duos people had already been told about. Once this is
 * written it is the answer, and `match-session.ts` only ever appends to it.
 */
export interface IRankingMatching {
  pairs: IRankingMatchPair[];
  unmatchedId?: string | null;
  computedAt: Date;
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
  matching?: IRankingMatching | null;
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

const RankingMatchPairSchema = new Schema<IRankingMatchPair>(
  {
    participant1Id: { type: String, required: true },
    participant2Id: { type: String, required: true },
    opposition: { type: Number, required: true },
  },
  { _id: false }
);

const RankingMatchingSchema = new Schema<IRankingMatching>(
  {
    pairs: { type: [RankingMatchPairSchema], default: [] },
    unmatchedId: { type: String, default: null },
    computedAt: { type: Date, required: true },
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
    // `default: undefined` so "never matched" stays absent rather than becoming
    // an empty matching that would read as "nobody paired up".
    matching: { type: RankingMatchingSchema, default: undefined },
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
