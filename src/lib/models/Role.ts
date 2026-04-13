import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRole extends Document {
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    rank: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.Role) {
  mongoose.deleteModel("Role");
}
export const RoleModel: Model<IRole> = mongoose.model<IRole>("Role", RoleSchema);
