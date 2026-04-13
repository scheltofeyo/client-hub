import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { RoleModel } from "@/lib/models/Role";
import { getLeadSettings } from "@/lib/models/LeadSettings";
import { seedRoles } from "@/lib/seed-roles";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // Define callbacks fully here — do NOT spread authConfig.callbacks
  // (the `authorized` callback is edge-only and belongs in proxy.ts only)
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      await connectDB();

      // Look up by googleId first, then by email (for invited-not-yet-linked employees)
      const existing = await UserModel.findOne({
        $or: [
          { googleId: account.providerAccountId },
          { email: user.email, googleId: { $exists: false } },
        ],
      });

      if (!existing) {
        // Not invited — reject login
        return "/login?error=not-invited";
      }

      if (existing.status === "inactive") {
        return "/login?error=account-inactive";
      }

      // Build update
      const update: Record<string, unknown> = {
        googleName: user.name ?? undefined,
        googleImage: user.image ?? undefined,
      };

      // Link Google account if first login after invitation
      if (!existing.googleId) {
        update.googleId = account.providerAccountId;
      }

      if (existing.status === "invited") {
        update.status = "active";
      }

      // Recompute name/image only if no admin override exists
      if (!existing.displayName) {
        const nameParts = [existing.firstName, existing.preposition, existing.lastName].filter(Boolean);
        update.name = existing.displayName ?? user.name ?? (nameParts.length > 0 ? nameParts.join(" ") : existing.name);
      }
      if (!existing.displayImage) {
        update.image = user.image ?? existing.image;
      }

      await UserModel.updateOne(
        { _id: existing._id },
        { $set: update }
      );

      return true;
    },

    async jwt({ token, account }) {
      // On first sign-in, enrich token from DB
      if (account?.provider === "google") {
        await connectDB();
        await seedRoles();
        const dbUser = await UserModel.findOne({ googleId: account.providerAccountId }).lean();
        if (dbUser) {
          token.userId = dbUser._id.toString();
          token.role = dbUser.role;
          token.image = dbUser.image ?? null;

          // Load role permissions
          const role = await RoleModel.findOne({ slug: dbUser.role }).lean();
          token.permissions = role?.permissions ?? [];

          // Load global lead settings (same for all users)
          token.leadPermissions = await getLeadSettings();
        }
      } else if (token.userId) {
        // Periodic re-check: invalidate session if user has been archived
        const now = Date.now();
        const lastCheck = (token.statusCheckedAt as number) ?? 0;
        if (now - lastCheck > 5 * 60 * 1000) {
          await connectDB();
          const dbUser = await UserModel.findById(token.userId, { status: 1 }).lean();
          if (!dbUser || dbUser.status === "inactive") {
            token.userId = "";
            token.permissions = [];
            token.leadPermissions = [];
          }
          token.statusCheckedAt = now;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = (token.role as string) ?? "member";
      session.user.permissions = (token.permissions as string[]) ?? [];
      session.user.leadPermissions = (token.leadPermissions as string[]) ?? [];
      session.user.image = (token.image as string | null) ?? (token.picture as string | undefined) ?? undefined;
      return session;
    },
  },
});
