import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  image?: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

if (mongoose.models.User) {
  mongoose.deleteModel("User");
}
export const UserModel: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
