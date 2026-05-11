import mongoose, { Schema, Document, Model } from "mongoose";

export type ProjectStatus = "draft" | "not_started" | "in_progress" | "completed";
export type PricingMode = "manual" | "rolebased";

export interface IRoleAllocationLine {
  roleId: string;
  roleName: string;
  days: number;
  dayRate: number;
  marginMultiplier: number;
  isExternal: boolean;
  externalCostRate?: number;
  assignedUser?: { userId: string; name: string; image?: string };
}

export interface IProject extends Document {
  clientId: string;
  planId?: string;
  title: string;
  description?: string;
  // Plan content (richtext HTML, sanitized at render time)
  why?: string;
  how?: string;
  what?: string;
  activities?: string;
  deliverables?: string;
  hiddenSections?: string[];
  status: ProjectStatus;
  completedDate?: string;
  deliveryDate?: string;
  soldPrice?: number;
  pricingMode: PricingMode;
  roleAllocation?: IRoleAllocationLine[];
  templateId?: string;
  serviceId?: string;
  labelId?: string;
  kickedOffAt?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  members?: { userId: string; name: string; image?: string }[];
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RoleAllocationLineSchema = new Schema<IRoleAllocationLine>(
  {
    roleId: { type: String, required: true },
    roleName: { type: String, required: true },
    days: { type: Number, required: true, default: 0 },
    dayRate: { type: Number, required: true, default: 0 },
    marginMultiplier: { type: Number, required: true, default: 1 },
    isExternal: { type: Boolean, default: false },
    externalCostRate: { type: Number },
    assignedUser: {
      type: new Schema(
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          image: { type: String },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    clientId: { type: String, required: true, index: true },
    planId: { type: String, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    why: { type: String },
    how: { type: String },
    what: { type: String },
    activities: { type: String },
    deliverables: { type: String },
    hiddenSections: { type: [String], default: undefined },
    status: {
      type: String,
      enum: ["draft", "not_started", "in_progress", "completed"],
      default: "not_started",
      index: true,
    },
    completedDate: { type: String, trim: true, index: true },
    deliveryDate: { type: String, trim: true, index: true },
    soldPrice: { type: Number },
    pricingMode: {
      type: String,
      enum: ["manual", "rolebased"],
      default: "rolebased",
    },
    roleAllocation: { type: [RoleAllocationLineSchema], default: undefined },
    templateId: { type: String },
    serviceId: { type: String },
    labelId: { type: String },
    kickedOffAt: { type: String, trim: true },
    scheduledStartDate: { type: String, trim: true, index: true },
    scheduledEndDate: { type: String, trim: true },
    members: {
      type: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          image: { type: String },
        },
      ],
      default: [],
    },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

ProjectSchema.index({ "members.userId": 1 });

if (mongoose.models.Project) {
  mongoose.deleteModel("Project");
}
export const ProjectModel: Model<IProject> = mongoose.model<IProject>("Project", ProjectSchema);

/**
 * Sum the price of all role allocation lines.
 * Pure helper, safe to call from anywhere.
 */
export function calculateRolebasedPrice(lines: IRoleAllocationLine[] | undefined | null): number {
  if (!lines || lines.length === 0) return 0;
  return lines.reduce((sum, l) => sum + (l.days || 0) * (l.dayRate || 0) * (l.marginMultiplier || 1), 0);
}

// Sum of what we pay out to external resources (internal-only metric).
export function calculateExternalCost(lines: IRoleAllocationLine[] | undefined | null): number {
  if (!lines || lines.length === 0) return 0;
  return lines.reduce(
    (sum, l) => (l.isExternal && l.externalCostRate ? sum + (l.days || 0) * l.externalCostRate : sum),
    0
  );
}
