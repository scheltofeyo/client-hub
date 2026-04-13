import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITimeOff extends Document {
  userId: mongoose.Types.ObjectId;
  startDate: string;
  endDate: string;
  startDayPortion: "full" | "am" | "pm";
  endDayPortion: "full" | "am" | "pm";
  leaveTypeSlug: string;
  notes?: string;
  status: "confirmed";
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimeOffSchema = new Schema<ITimeOff>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: "User", required: true },
    startDate:    { type: String, required: true },
    endDate:      { type: String, required: true },
    startDayPortion: { type: String, enum: ["full", "am", "pm"], default: "full" },
    endDayPortion:   { type: String, enum: ["full", "am", "pm"], default: "full" },
    leaveTypeSlug:   { type: String, required: true },
    notes:        { type: String, maxlength: 200 },
    status:       { type: String, enum: ["confirmed"], default: "confirmed" },
    createdById:  { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

TimeOffSchema.index({ userId: 1, startDate: 1, endDate: 1 });
TimeOffSchema.index({ startDate: 1, endDate: 1 });

if (mongoose.models.TimeOff) {
  mongoose.deleteModel("TimeOff");
}
export const TimeOffModel: Model<ITimeOff> = mongoose.model<ITimeOff>(
  "TimeOff",
  TimeOffSchema
);
