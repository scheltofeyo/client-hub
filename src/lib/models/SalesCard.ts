import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISalesCard extends Document {
  boardId: string;
  columnId: string;
  /** Always a Client with status "prospect" at the time the card was added. */
  clientId: string;
  order: number;
  owners: { userId: string; name: string; image?: string }[];
  /** Points at Client.contacts[].id */
  contactId?: string;
  source?: string;
  dealValue?: number;
  expectedCloseDate?: string;
  labels: string[];
  notes?: string;
  /** Set once the deal is closed — a card with an outcome counts as archived. */
  outcome?: "won" | "lost";
  outcomeAt?: string;
  outcomeById?: string;
  outcomeByName?: string;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesCardSchema = new Schema<ISalesCard>(
  {
    boardId: { type: String, required: true, index: true },
    columnId: { type: String, required: true },
    clientId: { type: String, required: true, index: true },
    order: { type: Number, default: 0 },
    owners: {
      type: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
          image: { type: String },
        },
      ],
      default: [],
    },
    contactId: { type: String },
    source: { type: String, trim: true },
    dealValue: { type: Number },
    expectedCloseDate: { type: String },
    labels: { type: [String], default: [] },
    notes: { type: String },
    outcome: { type: String, enum: ["won", "lost"] },
    outcomeAt: { type: String },
    outcomeById: { type: String },
    outcomeByName: { type: String },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

// Board render: equality on board+column, sort on order.
SalesCardSchema.index({ boardId: 1, columnId: 1, order: 1 });
SalesCardSchema.index({ "owners.userId": 1 });

if (mongoose.models.SalesCard) {
  mongoose.deleteModel("SalesCard");
}
export const SalesCardModel: Model<ISalesCard> = mongoose.model<ISalesCard>(
  "SalesCard",
  SalesCardSchema
);
