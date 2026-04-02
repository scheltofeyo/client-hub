import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEventType extends Document {
  slug: string;
  label: string;
  color: string;
  icon: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventTypeSchema = new Schema<IEventType>(
  {
    slug:  { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: "#6366f1" },
    icon:  { type: String, required: true, default: "Circle" },
    rank:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.EventType) {
  mongoose.deleteModel("EventType");
}
export const EventTypeModel: Model<IEventType> = mongoose.model<IEventType>(
  "EventType",
  EventTypeSchema
);

// Slugs used by auto-generated events — cannot be edited or deleted
export const SYSTEM_EVENT_TYPE_SLUGS = ["deadline", "delivery", "follow_up", "expired_service"] as const;

export const DEFAULT_EVENT_TYPES: Array<{
  slug: string;
  label: string;
  color: string;
  icon: string;
}> = [
  { slug: "check_in",       label: "Check-in",       color: "#0d9488", icon: "Users"        },
  { slug: "meeting",        label: "Meeting",         color: "#ea580c", icon: "Clock"        },
  { slug: "deadline",       label: "Deadline",        color: "#dc2626", icon: "Flag"         },
  { slug: "delivery",       label: "Delivery",        color: "#7c3aed", icon: "PackageCheck" },
  { slug: "follow_up",      label: "Follow-up",       color: "#3b82f6", icon: "AlarmClock"   },
  { slug: "expired_service",label: "Expired service", color: "#dc2626", icon: "PackageCheck" },
  { slug: "other",          label: "Other",           color: "#94a3b8", icon: "Circle"       },
];
