import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContact {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface IClientLead {
  userId: string;
  name: string;
  email: string;
}

export interface IClient extends Document {
  company: string;
  status?: string;
  platform?: string;
  clientSince?: string;
  employees?: number;
  website?: string;
  description?: string;
  contacts?: IContact[];
  leads?: IClientLead[];
  archetypeId?: string;
  folderStatus?: "pending" | "ready";
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    id: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    role: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const ClientLeadSchema = new Schema<IClientLead>(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false }
);

const ClientSchema = new Schema<IClient>(
  {
    company: { type: String, required: true, trim: true },
    status: { type: String, trim: true },
    platform: { type: String, trim: true },
    clientSince: { type: String, trim: true },
    employees: { type: Number },
    website: { type: String, trim: true },
    description: { type: String, trim: true },
    contacts: { type: [ContactSchema], default: [] },
    leads: { type: [ClientLeadSchema], default: [] },
    archetypeId: { type: String, trim: true },
    folderStatus: { type: String, enum: ["pending", "ready"] },
  },
  { timestamps: true }
);

// Always recompile the model so schema changes are picked up on hot reloads
if (mongoose.models.Client) {
  mongoose.deleteModel("Client");
}
export const ClientModel: Model<IClient> = mongoose.model<IClient>("Client", ClientSchema);
