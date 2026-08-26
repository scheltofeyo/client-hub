import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One person's live connection to one OAuth client — the row the "Connected
 * apps" list shows and the row a Revoke button kills.
 *
 * Deliberately one document per (user, client) rather than one per issued
 * token: refreshing rotates the two hashes in place, so a connection keeps a
 * stable identity across its whole life and the UI never grows a pile of
 * expired rows. Re-authorizing the same client replaces the grant instead of
 * stacking a second one.
 *
 * `scopes` are hub permission strings, so the effective rights are the same
 * intersection the personal API tokens compute (role ∩ scopes ∩ tokenGrantable)
 * — see sessionFromOAuthToken in src/lib/oauth.ts.
 */
export interface IOAuthGrant extends Document {
  userId: string;
  clientId: string;
  /** Snapshot of the client's name, so the UI and `createdVia` need no join. */
  clientName: string;
  scopes: string[];
  /** The resource this grant is bound to — our canonical MCP URI. */
  resource: string;
  /** sha256 hex. The secrets themselves are never stored. */
  accessTokenHash: string;
  accessTokenExpiresAt: string;
  refreshTokenHash?: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OAuthGrantSchema = new Schema<IOAuthGrant>(
  {
    userId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    scopes: { type: [String], default: [] },
    resource: { type: String, required: true },
    accessTokenHash: { type: String, required: true, index: true },
    accessTokenExpiresAt: { type: String, required: true },
    refreshTokenHash: { type: String, index: true },
    lastUsedAt: { type: String },
    revokedAt: { type: String },
  },
  { timestamps: true }
);

// One live connection per (user, client): re-authorizing updates the existing
// row rather than leaving an orphaned grant nobody can see to revoke.
OAuthGrantSchema.index({ userId: 1, clientId: 1 }, { unique: true });

// Always recompile the model so schema changes are picked up on hot reloads
if (mongoose.models.OAuthGrant) {
  mongoose.deleteModel("OAuthGrant");
}
export const OAuthGrantModel: Model<IOAuthGrant> = mongoose.model<IOAuthGrant>(
  "OAuthGrant",
  OAuthGrantSchema
);
