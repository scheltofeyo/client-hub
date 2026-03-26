import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILogSignal extends Document {
  name: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const LogSignalSchema = new Schema<ILogSignal>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    rank: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.LogSignal) {
  mongoose.deleteModel("LogSignal");
}
export const LogSignalModel: Model<ILogSignal> = mongoose.model<ILogSignal>(
  "LogSignal",
  LogSignalSchema
);
