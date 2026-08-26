import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { OAuthClientModel } from "@/lib/models/OAuthClient";
import {
  claimAuthCode,
  grantForRefreshToken,
  hubOrigin,
  issueTokens,
  resourceMatches,
  verifyPkce,
} from "@/lib/oauth";

/**
 * The token endpoint: authorization_code and refresh_token.
 *
 * Both grants funnel into issueTokens(), so first issue and rotation cannot
 * drift apart — a refresh produces exactly the credential shape a fresh consent
 * does, on the same grant row.
 *
 * Clients are public and authenticate with PKCE rather than a secret, so there
 * is no client_secret to check. What replaces it: the code is single-use and
 * claimed atomically, the verifier must hash to the challenge recorded at
 * consent time, and the redirect_uri must match the one the code was issued
 * for. A stolen code without the verifier is worthless.
 */

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    // OAuth 2.1 wants token responses uncached — they carry credentials.
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function tokenResponse(body: Record<string, unknown>) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

/**
 * The spec mandates application/x-www-form-urlencoded, but some clients post
 * JSON. Accepting both costs three lines and removes a whole class of
 * "connector just fails" reports.
 */
async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
  }
  const form = await req.formData();
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export async function POST(req: NextRequest) {
  const params = await readParams(req);
  const grantType = params.grant_type;
  const origin = hubOrigin(req.headers);

  if (grantType === "authorization_code") {
    const { code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId } = params;
    if (!code || !verifier || !redirectUri || !clientId) {
      return oauthError(
        "invalid_request",
        "code, code_verifier, redirect_uri and client_id are all required"
      );
    }

    // Claiming marks the code used whatever happens next, so a failed exchange
    // burns it rather than leaving it open for another attempt.
    const claimed = await claimAuthCode(code);
    if (!claimed) {
      return oauthError("invalid_grant", "This code is expired, unknown or already used");
    }

    if (claimed.clientId !== clientId || claimed.redirectUri !== redirectUri) {
      return oauthError("invalid_grant", "This code was not issued to this client");
    }
    if (!verifyPkce(verifier, claimed.codeChallenge)) {
      return oauthError("invalid_grant", "PKCE verification failed");
    }
    // A client may narrow the audience on the exchange but never move it.
    if (params.resource && !resourceMatches(params.resource, origin)) {
      return oauthError("invalid_target", "Token requested for another resource");
    }

    await connectDB();
    const client = await OAuthClientModel.findOne({ clientId }).lean();
    if (!client) return oauthError("invalid_client", "Unknown client", 401);

    const issued = await issueTokens({
      userId: claimed.userId,
      clientId,
      clientName: client.clientName,
      scopes: claimed.scopes,
      resource: claimed.resource,
    });

    return tokenResponse({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
      refresh_token: issued.refreshToken,
      scope: issued.scopes.join(" "),
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = params.refresh_token;
    if (!refreshToken) return oauthError("invalid_request", "refresh_token is required");

    const grant = await grantForRefreshToken(refreshToken);
    if (!grant) return oauthError("invalid_grant", "This refresh token is unknown or revoked");
    if (params.client_id && params.client_id !== grant.clientId) {
      return oauthError("invalid_grant", "This refresh token was not issued to this client");
    }

    // Rotation: the old refresh token stops working the moment the new pair is
    // written, because both hashes live on the one grant row.
    const issued = await issueTokens({
      userId: grant.userId,
      clientId: grant.clientId,
      clientName: grant.clientName,
      // Never widened on refresh — a refresh renews access, it does not
      // re-consent. Narrowing on request is allowed by the spec but no client
      // asks for it, so the granted set is simply carried forward.
      scopes: grant.scopes,
      resource: grant.resource,
    });

    return tokenResponse({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
      refresh_token: issued.refreshToken,
      scope: issued.scopes.join(" "),
    });
  }

  return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType ?? "(none)"}`);
}
