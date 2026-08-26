import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { OAuthClientModel } from "@/lib/models/OAuthClient";
import { hubOrigin, issueAuthCode, resourceMatches, verifyConsent } from "@/lib/oauth";
import { filterKnownScopes, mayDelegateScope } from "@/lib/mcp/scopes";

/**
 * Where the consent screen's Allow / Weigeren buttons land.
 *
 * The form carries one signed `consent` blob instead of a set of hidden inputs,
 * which is what stops a user from editing the scopes or the redirect target on
 * the way through and what stops another site from posting here on a signed-in
 * user's behalf. The signature is not the authorization, though — everything is
 * re-checked below against the database and the caller's live session, because
 * a signature only proves the values are the ones we rendered, not that they
 * are still allowed.
 *
 * Errors here are returned to the client via its redirect_uri rather than
 * rendered, because by this point the redirect target has been verified against
 * the client's registration.
 */

/** POST → GET, so the browser follows with a fresh GET at the client. */
function bounce(url: URL) {
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const consentToken = form.get("consent");
  const decision = form.get("decision");

  if (typeof consentToken !== "string") {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing consent" },
      { status: 400 }
    );
  }

  const consent = verifyConsent(consentToken);
  if (!consent) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "This approval expired or was tampered with. Start the connection again.",
      },
      { status: 400 }
    );
  }

  // The consent was minted for one specific person. Without this check, a blob
  // captured from one session could be replayed in another's browser.
  if (consent.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const client = await OAuthClientModel.findOne({ clientId: consent.clientId }).lean();
  if (!client || !client.redirectUris.includes(consent.redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Unknown client or redirect_uri" },
      { status: 400 }
    );
  }

  const origin = hubOrigin(req.headers);
  if (!resourceMatches(consent.resource, origin)) {
    return NextResponse.json(
      { error: "invalid_target", error_description: "Token requested for another resource" },
      { status: 400 }
    );
  }

  const redirect = new URL(consent.redirectUri);
  if (consent.state) redirect.searchParams.set("state", consent.state);
  // RFC 9207: naming ourselves on every response — including this error one —
  // lets the client detect a mix-up between two authorization servers.
  redirect.searchParams.set("iss", origin);

  if (decision !== "allow") {
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "De gebruiker heeft de koppeling geweigerd");
    return bounce(redirect);
  }

  // Re-checked against the live session rather than trusted from the blob: a
  // role can be narrowed between rendering the screen and clicking Allow, and
  // the grant must reflect what is true now. filterKnownScopes runs again here
  // so a grant can only ever hold scopes this server recognises.
  //
  // mayDelegateScope, not hasPermission: a lead-eligible scope may be delegated
  // on the strength of leading a client. It still confers nothing globally —
  // sessionFromOAuthToken derives `permissions` from the role, so a scope that
  // got in this way lands only in `leadPermissions`.
  const scopes = filterKnownScopes(consent.scopes).filter((scope) =>
    mayDelegateScope(session, scope)
  );

  const code = await issueAuthCode({
    userId: session.user.id,
    clientId: consent.clientId,
    redirectUri: consent.redirectUri,
    scopes,
    codeChallenge: consent.codeChallenge,
    resource: consent.resource,
  });

  redirect.searchParams.set("code", code);
  return bounce(redirect);
}
