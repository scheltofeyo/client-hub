import mongoose, { Schema, Document, Model } from "mongoose";

export type ProjectPlanStatus = "draft" | "ready" | "accepted" | "finalized";

export type AcceptanceEventType = "created" | "sent" | "accepted" | "revoked" | "finalized";
export type AcceptanceEventSource = "client" | "internal";

export interface IAcceptanceEvent {
  type: AcceptanceEventType;
  at: string;        // ISO datetime
  source: AcceptanceEventSource;
  by: { userId?: string; name: string; email?: string; image?: string };
}

export type ProposalLanguage = "nl" | "en";

export interface IProjectPlan extends Document {
  clientId: string;
  title: string;
  summary?: string;
  status: ProjectPlanStatus;
  vatRate?: number;
  shareCode: string;
  proposerStatement?: string;
  createdBy: { userId: string; name: string; image?: string };
  acceptedBy?: { userId: string; name: string; image?: string };
  acceptedAt?: string;
  presentedAt?: string;
  /** Set when accepted via the public share link, separate from internal acceptedBy. */
  acceptedByClient?: { name: string; email: string };
  /** Set when the plan is finalized (irreversible — projects are promoted to live). */
  finalizedAt?: string;
  finalizedBy?: { userId: string; name: string; image?: string };
  /** Full audit trail of accept / revoke / finalize events. Latest event last. */
  acceptanceLog?: IAcceptanceEvent[];

  /** Language the proposal renders in (NL or EN). Defaults to "nl". */
  language?: ProposalLanguage;
  /** ISO date (YYYY-MM-DD) until which the proposal is valid. */
  validUntilDate?: string;
  /** Auto-assigned on first transition to `ready`, e.g. "SUMM-2026-001". Never reassigned. */
  proposalNumber?: string;
  /** Manual free-text version label (V1, V2, …). Proposer-controlled. */
  versionLabel?: string;
  /** Rich HTML — "Probleemomschrijving". */
  challenge?: string;
  /** Rich HTML — "Aanleiding / context". */
  context?: string;
  /** Rich HTML — "Aanpakbeschrijving". */
  approach?: string;

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
      enum: ["draft", "ready", "accepted", "finalized"],
      default: "draft",
      index: true,
    },
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
    finalizedAt: { type: String, trim: true },
    finalizedBy: { type: UserSnapshotSchema, required: false },
    acceptanceLog: {
      type: [
        new Schema(
          {
            type: { type: String, enum: ["created", "sent", "accepted", "revoked", "finalized"], required: true },
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

    language: { type: String, enum: ["nl", "en"], default: "nl" },
    validUntilDate: { type: String, trim: true },
    proposalNumber: { type: String, trim: true },
    versionLabel: { type: String, trim: true },
    challenge: { type: String },
    context: { type: String },
    approach: { type: String },
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
