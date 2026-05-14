import mongoose, { Schema, Document, Model } from "mongoose";

export interface IArchetype extends Document {
  name: string;
  rank: number;
  color: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ArchetypeSchema = new Schema<IArchetype>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    rank: { type: Number, default: 0 },
    color: { type: String, trim: true, default: "#7C3AED" },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

if (mongoose.models.Archetype) {
  mongoose.deleteModel("Archetype");
}
export const ArchetypeModel: Model<IArchetype> = mongoose.model<IArchetype>(
  "Archetype",
  ArchetypeSchema
);
