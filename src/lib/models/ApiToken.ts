import mongoose, { Schema, Document, Model } from "mongoose";

export interface IApiToken extends Document {
  /** Owning user. A token always acts as a real person, never as a bot account. */
  userId: string;
  name: string;
  /** sha256 hex of the secret. The secret itself is never stored. */
  tokenHash: string;
  /** First few characters of the secret, kept only so the UI can identify a row. */
  prefix: string;
  /**
   * Optional narrowing. Empty/absent means "inherit whatever the owner's role
   * grants". A listed permission still only applies if the owner also has it —
   * the effective set is the intersection, computed per request.
   */
  permissions?: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiTokenSchema = new Schema<IApiToken>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    permissions: { type: [String], default: undefined },
    expiresAt: { type: String },
    lastUsedAt: { type: String },
    revokedAt: { type: String },
  },
  { timestamps: true }
);

// Always recompile the model so schema changes are picked up on hot reloads
if (mongoose.models.ApiToken) {
  mongoose.deleteModel("ApiToken");
}
export const ApiTokenModel: Model<IApiToken> = mongoose.model<IApiToken>(
  "ApiToken",
  ApiTokenSchema
);
