import mongoose, { Schema, Document, Model } from "mongoose";

export interface IKudosCategory extends Document {
  slug: string;
  label: string;
  color: string;
  icon: string;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const KudosCategorySchema = new Schema<IKudosCategory>(
  {
    slug:  { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: "#8b5cf6" },
    icon:  { type: String, required: true, default: "Sparkles" },
    rank:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.KudosCategory) {
  mongoose.deleteModel("KudosCategory");
}
export const KudosCategoryModel: Model<IKudosCategory> = mongoose.model<IKudosCategory>(
  "KudosCategory",
  KudosCategorySchema
);

export const DEFAULT_KUDOS_CATEGORIES: Array<{
  slug: string;
  label: string;
  color: string;
  icon: string;
}> = [
  { slug: "team-player",      label: "Team player",       color: "#0d9488", icon: "Users"      },
  { slug: "above-and-beyond", label: "Boven verwachting", color: "#ea580c", icon: "Rocket"     },
  { slug: "klantheld",        label: "Klantheld",         color: "#3b82f6", icon: "HeartHandshake" },
  { slug: "creative-spark",   label: "Creatieve vonk",    color: "#a855f7", icon: "Sparkles"   },
  { slug: "helping-hand",     label: "Helpende hand",     color: "#22c55e", icon: "Hand"       },
];
