import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * An OAuth client that may ask for access to the hub — in practice the Claude
 * app or Claude Code, each registering itself the first time someone adds the
 * connector.
 *
 * Clients are public, not confidential: they run on someone's machine and can
 * keep no secret, so PKCE is the protection and `clientSecretHash` stays unset.
 * The field exists only for a pre-registered confidential client, which the
 * spec allows and which we may want later for a server-side integration.
 */
export interface IOAuthClient extends Document {
  /** Public identifier handed to the client. Random, not guessable. */
  clientId: string;
  /** Self-declared name, shown on the consent screen and stamped onto grants. */
  clientName: string;
  /**
   * Exact redirect targets. Matched literally on every authorization request —
   * never by prefix, which is the classic open-redirect hole in OAuth servers.
   */
  redirectUris: string[];
  /** Only set for a confidential client; public clients rely on PKCE. */
  clientSecretHash?: string;
  tokenEndpointAuthMethod: "none" | "client_secret_post";
  grantTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const OAuthClientSchema = new Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true },
    redirectUris: { type: [String], required: true },
    clientSecretHash: { type: String },
    tokenEndpointAuthMethod: {
      type: String,
      enum: ["none", "client_secret_post"],
      default: "none",
    },
    grantTypes: { type: [String], default: ["authorization_code", "refresh_token"] },
  },
  { timestamps: true }
);

// Always recompile the model so schema changes are picked up on hot reloads
if (mongoose.models.OAuthClient) {
  mongoose.deleteModel("OAuthClient");
}
export const OAuthClientModel: Model<IOAuthClient> = mongoose.model<IOAuthClient>(
  "OAuthClient",
  OAuthClientSchema
);
