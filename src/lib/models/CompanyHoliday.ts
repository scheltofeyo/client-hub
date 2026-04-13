import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompanyHoliday extends Document {
  date: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyHolidaySchema = new Schema<ICompanyHoliday>(
  {
    date:  { type: String, required: true, unique: true },
    label: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

if (mongoose.models.CompanyHoliday) {
  mongoose.deleteModel("CompanyHoliday");
}
export const CompanyHolidayModel: Model<ICompanyHoliday> = mongoose.model<ICompanyHoliday>(
  "CompanyHoliday",
  CompanyHolidaySchema
);
