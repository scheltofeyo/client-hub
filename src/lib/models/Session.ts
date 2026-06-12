import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISession extends Document {
  clientId: string;
  projectId: string;
  title: string;
  date?: string;
  location?: string;
  remoteLink?: string;
  participants: { email: string; name?: string }[];
  info?: string;
  order: number;
  templateSessionId?: string;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    clientId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    date: { type: String, trim: true, index: true },
    location: { type: String, trim: true },
    remoteLink: { type: String, trim: true },
    participants: {
      type: [
        {
          email: { type: String, required: true, trim: true },
          name: { type: String, trim: true },
        },
      ],
      default: [],
    },
    info: { type: String, trim: true },
    order: { type: Number, default: 0 },
    templateSessionId: { type: String },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

if (mongoose.models.Session) {
  mongoose.deleteModel("Session");
}
export const SessionModel: Model<ISession> = mongoose.model<ISession>("Session", SessionSchema);
