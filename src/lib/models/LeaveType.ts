import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILeaveType extends Document {
  slug: string;
  label: string;
  color: string;
  icon: string;
  rank: number;
  countsAgainstAllowance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveTypeSchema = new Schema<ILeaveType>(
  {
    slug:   { type: String, required: true, trim: true, unique: true },
    label:  { type: String, required: true, trim: true },
    color:  { type: String, required: true, default: "#7c3aed" },
    icon:   { type: String, required: true, default: "Sun" },
    rank:   { type: Number, default: 0 },
    countsAgainstAllowance: { type: Boolean, default: false },
  },
  { timestamps: true }
);

if (mongoose.models.LeaveType) {
  mongoose.deleteModel("LeaveType");
}
export const LeaveTypeModel: Model<ILeaveType> = mongoose.model<ILeaveType>(
  "LeaveType",
  LeaveTypeSchema
);

export const DEFAULT_LEAVE_TYPES: Array<{
  slug: string;
  label: string;
  color: string;
  icon: string;
  countsAgainstAllowance: boolean;
}> = [
  { slug: "vacation",  label: "Vacation",    color: "#7c3aed", icon: "Sun",          countsAgainstAllowance: true },
  { slug: "sick",      label: "Sick Leave",  color: "#dc2626", icon: "Thermometer",  countsAgainstAllowance: false },
  { slug: "personal",  label: "Personal",    color: "#0891b2", icon: "User",         countsAgainstAllowance: false },
];
