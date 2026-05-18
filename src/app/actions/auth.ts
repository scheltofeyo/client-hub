"use server";

import { signOut } from "@/auth";

/**
 * Server-action wrapper around Auth.js v5's signOut. Use this from the
 * UserMenu (and anywhere else we trigger signout) instead of the
 * `next-auth/react` client-side helper.
 *
 * The client-side helper POSTs to /api/auth/signout via the Route
 * Handler pipeline. In our setup (JWT strategy + custom jwt callback)
 * that path triggers a second pass through the jwt callback which
 * returns the still-valid token, and Auth.js then re-issues the
 * session cookie in the same response — defeating the signout (the
 * response contains both a clear-cookie and a fresh set-cookie for
 * the session token; last one wins).
 *
 * Calling signOut() directly from a server action avoids the Route
 * Handler entirely and reliably clears the cookie.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
