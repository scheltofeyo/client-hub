import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // Define callbacks fully here — do NOT spread authConfig.callbacks
  // (the `authorized` callback is edge-only and belongs in proxy.ts only)
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      await connectDB();

      const existing = await UserModel.findOne({ googleId: account.providerAccountId });
      if (!existing) {
        await UserModel.create({
          googleId: account.providerAccountId,
          email: user.email ?? "",
          name: user.name ?? "Unknown",
          image: user.image ?? undefined,
          isAdmin: false,
        });
      } else {
        await UserModel.updateOne(
          { googleId: account.providerAccountId },
          { $set: { image: user.image ?? undefined } }
        );
      }
      return true;
    },

    async jwt({ token, account }) {
      // On first sign-in, enrich token from DB
      if (account?.provider === "google") {
        await connectDB();
        const dbUser = await UserModel.findOne({ googleId: account.providerAccountId }).lean();
        if (dbUser) {
          token.userId = dbUser._id.toString();
          token.isAdmin = dbUser.isAdmin;
          token.image = dbUser.image ?? null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      session.user.image = (token.image as string | null) ?? (token.picture as string | undefined) ?? undefined;
      return session;
    },
  },
});
