import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISalesBoardColumn {
  id: string;
  title: string;
  color: string;
  rank: number;
}

export interface ISalesBoard extends Document {
  name: string;
  description?: string;
  rank: number;
  columns: ISalesBoardColumn[];
  createdById: string;
  createdByName: string;
  /** Name of the API token this was written through; absent means by hand. */
  createdVia?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Columns are embedded but carry a stable own `id` — SalesCard.columnId points at it. */
const SalesBoardColumnSchema = new Schema<ISalesBoardColumn>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    rank: { type: Number, default: 0 },
  },
  { _id: false }
);

const SalesBoardSchema = new Schema<ISalesBoard>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    rank: { type: Number, default: 0 },
    columns: { type: [SalesBoardColumnSchema], default: [] },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
    createdVia: { type: String },
  },
  { timestamps: true }
);

// Always recompile the model so schema changes are picked up on hot reloads
if (mongoose.models.SalesBoard) {
  mongoose.deleteModel("SalesBoard");
}
export const SalesBoardModel: Model<ISalesBoard> = mongoose.model<ISalesBoard>(
  "SalesBoard",
  SalesBoardSchema
);

/** Seeded onto every new board so it is usable straight away. */
export const DEFAULT_SALES_COLUMNS: { title: string; color: string }[] = [
  { title: "Nieuw", color: "#94A3B8" },
  { title: "Contact gelegd", color: "#7C3AED" },
  { title: "Voorstel", color: "#2563EB" },
  { title: "Onderhandeling", color: "#F59E0B" },
];
