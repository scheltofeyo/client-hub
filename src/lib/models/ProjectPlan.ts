import mongoose, { Schema, Document, Model } from "mongoose";

export type ProjectPlanStatus = "draft" | "ready" | "accepted" | "archived";
export type PlanDiscountType = "percentage" | "amount";

export type AcceptanceEventType = "created" | "sent" | "accepted" | "revoked";
export type AcceptanceEventSource = "client" | "internal";

export interface IAcceptanceEvent {
  type: AcceptanceEventType;
  at: string;        // ISO datetime
  source: AcceptanceEventSource;
  by: { userId?: string; name: string; email?: string; image?: string };
}

export interface IProjectPlan extends Document {
  clientId: string;
  title: string;
  summary?: string;
  status: ProjectPlanStatus;
  discountType?: PlanDiscountType;
  discountValue?: number;
  vatRate?: number;
  shareCode: string;
  proposerStatement?: string;
  createdBy: { userId: string; name: string; image?: string };
  acceptedBy?: { userId: string; name: string; image?: string };
  acceptedAt?: string;
  presentedAt?: string;
  /** Set when accepted via the public share link, separate from internal acceptedBy. */
  acceptedByClient?: { name: string; email: string };
  /** Full audit trail of accept / revoke events. Latest event last. */
  acceptanceLog?: IAcceptanceEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSnapshotSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String },
  },
  { _id: false }
);

const ProjectPlanSchema = new Schema<IProjectPlan>(
  {
    clientId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String },
    status: {
      type: String,
      enum: ["draft", "ready", "accepted", "archived"],
      default: "draft",
      index: true,
    },
    discountType: { type: String, enum: ["percentage", "amount"] },
    discountValue: { type: Number },
    vatRate: { type: Number },
    shareCode: { type: String, required: true, unique: true, index: true },
    proposerStatement: { type: String, trim: true },
    createdBy: { type: UserSnapshotSchema, required: true },
    acceptedBy: { type: UserSnapshotSchema, required: false },
    acceptedAt: { type: String, trim: true },
    presentedAt: { type: String, trim: true },
    acceptedByClient: {
      type: new Schema(
        { name: { type: String, required: true }, email: { type: String, required: true } },
        { _id: false }
      ),
      required: false,
    },
    acceptanceLog: {
      type: [
        new Schema(
          {
            type: { type: String, enum: ["created", "sent", "accepted", "revoked"], required: true },
            at: { type: String, required: true },
            source: { type: String, enum: ["client", "internal"], required: true },
            by: {
              type: new Schema(
                {
                  userId: { type: String },
                  name: { type: String, required: true },
                  email: { type: String },
                  image: { type: String },
                },
                { _id: false }
              ),
              required: true,
            },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

if (mongoose.models.ProjectPlan) {
  mongoose.deleteModel("ProjectPlan");
}
export const ProjectPlanModel: Model<IProjectPlan> = mongoose.model<IProjectPlan>(
  "ProjectPlan",
  ProjectPlanSchema
);
