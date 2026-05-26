import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One row per calendar year. Atomically incremented to mint the next offertenummer
 * (SUMM-{year}-{padded}). Plan only gets a number assigned on first transition
 * to `ready` — never reassigned after that, even on revoke→ready cycles.
 */
export interface IProposalSequence extends Document {
  year: number;
  lastNumber: number;
}

const ProposalSequenceSchema = new Schema<IProposalSequence>(
  {
    year: { type: Number, required: true, unique: true, index: true },
    lastNumber: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.ProposalSequence) {
  mongoose.deleteModel("ProposalSequence");
}
export const ProposalSequenceModel: Model<IProposalSequence> =
  mongoose.model<IProposalSequence>("ProposalSequence", ProposalSequenceSchema);

/**
 * Atomically allocate the next proposal number for the given year and format it.
 * Caller is responsible for persisting the returned string onto the ProjectPlan.
 */
export async function allocateNextProposalNumber(year: number = new Date().getFullYear()): Promise<string> {
  const doc = await ProposalSequenceModel.findOneAndUpdate(
    { year },
    { $inc: { lastNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const padded = String(doc!.lastNumber).padStart(3, "0");
  return `SUMM-${year}-${padded}`;
}
