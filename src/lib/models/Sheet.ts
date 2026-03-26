import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISheet extends Document {
  clientId: string;
  name: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

const SheetSchema = new Schema<ISheet>(
  {
    clientId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

if (mongoose.models.Sheet) {
  mongoose.deleteModel("Sheet");
}
export const SheetModel: Model<ISheet> = mongoose.model<ISheet>("Sheet", SheetSchema);
