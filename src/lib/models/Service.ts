import mongoose, { Schema, Document, Model } from "mongoose";

export interface IService extends Document {
  name: string;
  rank: number;
  checkInDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    name:        { type: String, required: true, trim: true, unique: true },
    rank:        { type: Number, default: 0 },
    checkInDays: { type: Number, default: null },
  },
  { timestamps: true }
);

if (mongoose.models.Service) {
  mongoose.deleteModel("Service");
}
export const ServiceModel: Model<IService> = mongoose.model<IService>(
  "Service",
  ServiceSchema
);
