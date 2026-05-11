import mongoose, { Schema, Document, Model } from "mongoose";
import type { PricingMode, IRoleAllocationLine } from "./Project";

export interface IProjectTemplate extends Document {
  name: string;
  summary?: string;
  defaultDescription?: string;
  defaultWhy?: string;
  defaultHow?: string;
  defaultWhat?: string;
  defaultActivities?: string;
  defaultDeliverables?: string;
  defaultSoldPrice?: number;
  defaultServiceId?: string;
  defaultDeliveryDays?: number;
  defaultPricingMode?: PricingMode;
  defaultRoleAllocation?: IRoleAllocationLine[];
  createdAt: Date;
  updatedAt: Date;
}

const TemplateRoleAllocationLineSchema = new Schema(
  {
    roleId: { type: String, required: true },
    roleName: { type: String, required: true },
    days: { type: Number, required: true, default: 0 },
    dayRate: { type: Number, required: true, default: 0 },
    marginMultiplier: { type: Number, required: true, default: 1 },
    isExternal: { type: Boolean, default: false },
    externalCostRate: { type: Number },
  },
  { _id: false }
);

const ProjectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    defaultDescription: { type: String, trim: true },
    defaultWhy: { type: String },
    defaultHow: { type: String },
    defaultWhat: { type: String },
    defaultActivities: { type: String },
    defaultDeliverables: { type: String },
    defaultSoldPrice: { type: Number },
    defaultServiceId: { type: String },
    defaultDeliveryDays: { type: Number },
    defaultPricingMode: { type: String, enum: ["manual", "rolebased"], default: "rolebased" },
    defaultRoleAllocation: { type: [TemplateRoleAllocationLineSchema], default: undefined },
  },
  { timestamps: true, strict: false }
);

if (mongoose.models.ProjectTemplate) {
  mongoose.deleteModel("ProjectTemplate");
}
export const ProjectTemplateModel: Model<IProjectTemplate> = mongoose.model<IProjectTemplate>(
  "ProjectTemplate",
  ProjectTemplateSchema
);
