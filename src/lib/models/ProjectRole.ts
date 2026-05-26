import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProjectRole extends Document {
  name: string;
  dayRate: number;
  marginMultiplier: number;
  isExternal: boolean;
  externalCostRate?: number;
  rank: number;
  /** Short bio shown on the proposal team page (NL). */
  bioNL?: string;
  /** Short bio shown on the proposal team page (EN). */
  bioEN?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectRoleSchema = new Schema<IProjectRole>(
  {
    name:             { type: String, required: true, trim: true, unique: true },
    dayRate:          { type: Number, required: true, default: 0 },
    marginMultiplier: { type: Number, required: true, default: 1 },
    isExternal:       { type: Boolean, default: false },
    externalCostRate: { type: Number },
    rank:             { type: Number, default: 0 },
    bioNL:            { type: String, trim: true },
    bioEN:            { type: String, trim: true },
  },
  { timestamps: true }
);

if (mongoose.models.ProjectRole) {
  mongoose.deleteModel("ProjectRole");
}
export const ProjectRoleModel: Model<IProjectRole> = mongoose.model<IProjectRole>(
  "ProjectRole",
  ProjectRoleSchema
);
