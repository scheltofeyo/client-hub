import mongoose, { Schema, Document, Model } from "mongoose";
import type { RecurrenceUnit } from "@/types";

export type ClientEventType = string;
export type RecurrenceFrequency = "none" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export interface IClientEvent extends Document {
  clientId: string;
  title: string;
  date: string; // start date (first occurrence)
  type: ClientEventType;
  /** @deprecated old format — new docs use recurrenceInterval + recurrenceUnit */
  recurrence: RecurrenceFrequency;
  recurrenceInterval?: number; // e.g. 2
  recurrenceUnit?: RecurrenceUnit; // e.g. "weeks"
  repetitions?: number; // total occurrences; undefined = unlimited
  notes?: string;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientEventSchema = new Schema<IClientEvent>(
  {
    clientId:            { type: String, required: true, index: true },
    title:               { type: String, required: true, trim: true },
    date:                { type: String, required: true },
    type:                { type: String, required: true },
    recurrence:          { type: String, default: "none" },
    recurrenceInterval:  { type: Number },
    recurrenceUnit:      { type: String },
    repetitions:         { type: Number },
    notes:               { type: String, trim: true },
    createdById:         { type: String, required: true },
    createdByName:       { type: String, required: true },
  },
  { timestamps: true }
);

if (mongoose.models.ClientEvent) {
  mongoose.deleteModel("ClientEvent");
}
export const ClientEventModel: Model<IClientEvent> = mongoose.model<IClientEvent>(
  "ClientEvent",
  ClientEventSchema
);
