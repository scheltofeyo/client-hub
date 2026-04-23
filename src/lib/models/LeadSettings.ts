import mongoose, { Schema, Document, Model } from "mongoose";
import { LEAD_ELIGIBLE_PERMISSIONS } from "@/lib/permissions";

export interface ILeadSettings extends Document {
  permissions: string[];
  updatedAt: Date;
}

const LeadSettingsSchema = new Schema<ILeadSettings>(
  {
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

if (mongoose.models.LeadSettings) {
  mongoose.deleteModel("LeadSettings");
}
export const LeadSettingsModel: Model<ILeadSettings> = mongoose.model<ILeadSettings>(
  "LeadSettings",
  LeadSettingsSchema
);

/** Default lead permissions (matches historical behavior). */
export const DEFAULT_LEAD_PERMISSIONS = [
  "clients.edit",
  "projects.create",
  "projects.edit",
  "projects.kickoff",
];

/** Get the singleton lead settings, creating with defaults if missing. */
export async function getLeadSettings(): Promise<string[]> {
  let doc = await LeadSettingsModel.findOne().lean();
  if (!doc) {
    doc = await LeadSettingsModel.create({ permissions: DEFAULT_LEAD_PERMISSIONS });
  }
  const eligible = new Set<string>(LEAD_ELIGIBLE_PERMISSIONS);
  return doc.permissions.filter((p) => eligible.has(p));
}
