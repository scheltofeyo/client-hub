import mongoose, { Schema, Document, Model } from "mongoose";

export interface IClientPlatformOption extends Document {
  slug: string;
  label: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClientPlatformOptionSchema = new Schema<IClientPlatformOption>(
  {
    slug:  { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true, unique: true },
    rank:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.ClientPlatformOption) {
  mongoose.deleteModel("ClientPlatformOption");
}
export const ClientPlatformOptionModel: Model<IClientPlatformOption> = mongoose.model<IClientPlatformOption>(
  "ClientPlatformOption",
  ClientPlatformOptionSchema
);

export const DEFAULT_CLIENT_PLATFORMS = [
  { slug: "summ_core",  label: "SUMM Core"  },
  { slug: "summ_suite", label: "SUMM Suite" },
];
