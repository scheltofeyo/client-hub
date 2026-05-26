import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Singleton: SUMM's own identity — used on the proposal PDF cover and identity strip.
 * Required fields are validated on save in the admin UI; the model itself keeps them
 * optional so a fresh DB can mint an empty singleton on first GET.
 */
export interface IOrganizationSettings extends Document {
  logoUrl?: string;
  addressStreet?: string;
  addressCity?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  kvkNumber?: string;
  btwNumber?: string;
  iban?: string;
  website?: string;
  email?: string;
  updatedAt: Date;
}

const OrganizationSettingsSchema = new Schema<IOrganizationSettings>(
  {
    logoUrl: { type: String, trim: true },
    addressStreet: { type: String, trim: true },
    addressCity: { type: String, trim: true },
    addressPostalCode: { type: String, trim: true },
    addressCountry: { type: String, trim: true, default: "Nederland" },
    kvkNumber: { type: String, trim: true },
    btwNumber: { type: String, trim: true },
    iban: { type: String, trim: true },
    website: { type: String, trim: true },
    email: { type: String, trim: true },
  },
  { timestamps: true }
);

if (mongoose.models.OrganizationSettings) {
  mongoose.deleteModel("OrganizationSettings");
}
export const OrganizationSettingsModel: Model<IOrganizationSettings> =
  mongoose.model<IOrganizationSettings>("OrganizationSettings", OrganizationSettingsSchema);

/** Get the singleton, creating an empty one if missing. */
export async function getOrganizationSettings() {
  let doc = await OrganizationSettingsModel.findOne().lean();
  if (!doc) {
    const created = await OrganizationSettingsModel.create({});
    doc = created.toObject();
  }
  return doc;
}
