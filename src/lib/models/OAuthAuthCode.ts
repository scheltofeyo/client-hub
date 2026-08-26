import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * A one-shot authorization code, alive for about a minute between the consent
 * screen and the token exchange.
 *
 * Everything the token endpoint must verify is frozen here at issue time —
 * the client, the exact redirect URI, the PKCE challenge, the resource and the
 * approved scopes — so the exchange re-checks the request the user actually
 * consented to rather than whatever the client sends second time around.
 *
 * `usedAt` makes replay detectable: the exchange claims the code with an atomic
 * findOneAndUpdate, so two racing exchanges cannot both win.
 */
export interface IOAuthAuthCode extends Document {
  /** sha256 hex of the code. The code itself is never stored. */
  codeHash: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  /** PKCE S256 challenge. Plain challenges are not accepted. */
  codeChallenge: string;
  resource: string;
  expiresAt: Date;
  usedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OAuthAuthCodeSchema = new Schema<IOAuthAuthCode>(
  {
    codeHash: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    clientId: { type: String, required: true },
    redirectUri: { type: String, required: true },
    scopes: { type: [String], default: [] },
    codeChallenge: { type: String, required: true },
    resource: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: String },
  },
  { timestamps: true }
);

// Mongo sweeps expired codes on its own, so a used or abandoned code does not
// linger. Expiry is still checked in code — the TTL monitor runs about once a
// minute, which is too coarse to be the security boundary.
OAuthAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Always recompile the model so schema changes are picked up on hot reloads
if (mongoose.models.OAuthAuthCode) {
  mongoose.deleteModel("OAuthAuthCode");
}
export const OAuthAuthCodeModel: Model<IOAuthAuthCode> = mongoose.model<IOAuthAuthCode>(
  "OAuthAuthCode",
  OAuthAuthCodeSchema
);
