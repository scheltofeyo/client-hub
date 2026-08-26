import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/mongodb";
import { OAuthClientModel } from "@/lib/models/OAuthClient";

/**
 * Dynamic Client Registration (RFC 7591).
 *
 * The current MCP revision deprecates DCR in favour of Client ID Metadata
 * Documents and allows pre-registered clients instead, so this is not strictly
 * required. It is here because it is what makes the connector zero-config: the
 * alternative is asking every team member to paste a client ID into the Claude
 * app by hand, and the acceptance criterion is explicitly that nobody has to.
 *
 * Registration is deliberately open, as the RFC intends. It grants nothing on
 * its own — a registered client can only ask a signed-in person for consent,
 * and that person still has to be an invited employee holding
 * integrations.tokens. What a client may become is bounded at the consent
 * screen, not here.
 */

/** Public identifier, random rather than sequential so it is not enumerable. */
function generateClientId(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Redirect targets must be https, or loopback for a desktop client that
 * catches the callback on a local port. Everything else — custom schemes,
 * plain http on a real host, anything with a fragment — is refused, because
 * this value becomes a place we send an authorization code.
 */
function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  );
}

function invalidMetadata(description: string) {
  return NextResponse.json(
    { error: "invalid_client_metadata", error_description: description },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return invalidMetadata("Body must be JSON");
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return invalidMetadata("redirect_uris is required");
  }
  if (!redirectUris.every(isAllowedRedirectUri)) {
    return invalidMetadata(
      "Every redirect_uri must be https, or http on localhost for a local client"
    );
  }

  const clientName =
    typeof body.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim().slice(0, 80)
      : "Onbekende app";

  const clientId = generateClientId();

  await connectDB();
  await OAuthClientModel.create({
    clientId,
    clientName,
    redirectUris,
    // Public client: no secret to issue, PKCE does the work. Handing out a
    // secret that has to live on someone's laptop would be theatre.
    tokenEndpointAuthMethod: "none",
    grantTypes: ["authorization_code", "refresh_token"],
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      // No client_secret and no expiry: the registration stays valid until the
      // client is deleted, which is what RFC 7591 means by 0.
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201 }
  );
}
