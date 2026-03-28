import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityEvent extends Document {
  clientId: string;
  actorId: string;
  actorName: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityEventSchema = new Schema<IActivityEvent>(
  {
    clientId: { type: String, required: true, index: true },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    type: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivityEventSchema.index({ clientId: 1, createdAt: -1 });

if (mongoose.models.ActivityEvent) {
  mongoose.deleteModel("ActivityEvent");
}
export const ActivityEventModel: Model<IActivityEvent> = mongoose.model<IActivityEvent>(
  "ActivityEvent",
  ActivityEventSchema
);
