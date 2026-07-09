import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config — no Node.js-only imports (no Mongoose, no DB)
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // `trustHost: true` lets Auth.js derive the host from the request when no
  // AUTH_URL env var is present. On Netlify we ALSO set AUTH_URL explicitly
  // so the cookie-domain and CSRF-origin checks are deterministic — without
  // that, sign-out fails silently on production (POST /api/auth/signout is
  // rejected by the CSRF check, cookies stay set, the post-signout redirect
  // to /login picks up the still-valid session and bounces straight back).
  // See CLAUDE.md for the required production env vars.
  trustHost: true,
  // Use the default `__Secure-` prefix on the session-token cookie in prod
  // (Auth.js auto-enables this when AUTH_URL or the inferred host is https).
  // Naming the cookie explicitly here keeps behavior deterministic across
  // localhost / preview / prod and across Auth.js minor versions.
  cookies: {
    sessionToken: {
      name: process.env.AUTH_URL?.startsWith("https://")
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  callbacks: {
    // Edge-only session mapping: expose the custom userId claim so `authorized`
    // can tell a live session from a revoked one. The jwt callback in
    // src/auth.ts zeroes token.userId when a user is deactivated, but the
    // cookie itself stays decodable — without this check the /login redirect
    // below would bounce deactivated users back into the app forever
    // (/my-day → /api/auth/signin → /login → /my-day). The full app uses the
    // richer callbacks in src/auth.ts, which replace (not spread) these.
    session({ session, token }) {
      session.user.id = (token.userId as string) ?? "";
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // Signed-in users get bounced away from /login here at the edge (a free
      // JWT decode) so the login page itself can stay fully static — it no
      // longer calls auth() and is served straight from the CDN. Only sessions
      // with a live userId bounce; a decodable-but-revoked cookie (deactivated
      // user) falls through to the login page so they can see the error state.
      if (pathname === "/login") {
        return auth?.user?.id
          ? Response.redirect(new URL("/my-day", request.nextUrl))
          : true;
      }
      if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/internal/") || pathname.startsWith("/api/public/") || pathname.startsWith("/ranking/") || pathname.startsWith("/proposal/") || pathname.startsWith("/s/") || pathname.startsWith("/archetype-as-is-survey/")) return true;
      return !!auth;
    },
  },
};
