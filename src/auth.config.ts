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
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth") || pathname === "/login" || pathname.startsWith("/api/internal/")) return true;
      return !!auth;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.isAdmin !== undefined) session.user.isAdmin = token.isAdmin as boolean;
      return session;
    },
  },
};
