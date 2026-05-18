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
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth") || pathname === "/login" || pathname.startsWith("/api/internal/") || pathname.startsWith("/api/public/") || pathname.startsWith("/ranking/") || pathname.startsWith("/proposal/") || pathname.startsWith("/s/") || pathname.startsWith("/archetype-as-is-survey/")) return true;
      return !!auth;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
};
