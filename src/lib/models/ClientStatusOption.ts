import mongoose, { Schema, Document, Model } from "mongoose";

export interface IClientStatusOption extends Document {
  slug: string;
  label: string;
  rank: number;
  checkInDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClientStatusOptionSchema = new Schema<IClientStatusOption>(
  {
    slug:        { type: String, required: true, trim: true, unique: true },
    label:       { type: String, required: true, trim: true, unique: true },
    rank:        { type: Number, default: 0 },
    checkInDays: { type: Number, default: null },
  },
  { timestamps: true }
);

if (mongoose.models.ClientStatusOption) {
  mongoose.deleteModel("ClientStatusOption");
}
export const ClientStatusOptionModel: Model<IClientStatusOption> = mongoose.model<IClientStatusOption>(
  "ClientStatusOption",
  ClientStatusOptionSchema
);

export const DEFAULT_CLIENT_STATUSES = [
  { slug: "active",   label: "Active"   },
  { slug: "inactive", label: "Inactive" },
  { slug: "prospect", label: "Prospect" },
];
