import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { RoleModel } from "@/lib/models/Role";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";
import { getLeadSettings } from "@/lib/models/LeadSettings";

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

      // Propagate image change into task assignee snapshots so reads don't need a live lookup.
      if (user.image && user.image !== existing.googleImage) {
        const userId = existing._id.toString();
        TaskModel.updateMany(
          { "assignees.userId": userId },
          { $set: { "assignees.$[elem].image": user.image } },
          { arrayFilters: [{ "elem.userId": userId }] }
        ).catch(() => {});
        ProjectModel.updateMany(
          { "members.userId": userId },
          { $set: { "members.$[elem].image": user.image } },
          { arrayFilters: [{ "elem.userId": userId }] }
        ).catch(() => {});
      }

      return true;
    },

    /**
     * Runs on every request that decodes the JWT. We minimize DB work in three
     * tiers:
     *
     *  1. `trigger === "update"` — client-initiated session.update(). Merge the
     *     supplied fields (only `seenWhatsNewIds` today) and return. Zero DB.
     *  2. First sign-in (`account?.provider === "google"`) — fetch user + role +
     *     lead settings to seed the token. One-time cost.
     *  3. Subsequent requests — gated by a 15-minute `statusCheckedAt` window.
     *     Within the window: zero DB. At the boundary: re-read the user (cheap,
     *     by _id) to detect status flips, then skip the RoleModel lookup if the
     *     user's role slug hasn't changed (`token.role === dbUser.role`).
     *     Lead settings are always re-read because they are a global singleton
     *     that admins can flip without changing any user's role.
     *
     * Permission / role changes take effect on the next refresh after the
     * 15-minute boundary (worst case ~15 min latency). This is documented in
     * CLAUDE.md and acceptable for our team size.
     */
    async jwt({ token, account, trigger, session }) {
      // Client-initiated session.update() — merge new seenWhatsNewIds into the token
      // so dismissals persist across page reloads without hitting the DB on every render.
      if (trigger === "update" && session && typeof session === "object") {
        const incoming = (session as { seenWhatsNewIds?: string[] }).seenWhatsNewIds;
        if (Array.isArray(incoming)) {
          token.seenWhatsNewIds = incoming;
        }
        return token;
      }

      // On first sign-in, enrich token from DB
      if (account?.provider === "google") {
        await connectDB();
        const dbUser = await UserModel.findOne({ googleId: account.providerAccountId }).lean();
        if (dbUser) {
          token.userId = dbUser._id.toString();
          token.role = dbUser.role;
          token.image = dbUser.image ?? null;
          token.seenWhatsNewIds = dbUser.seenWhatsNewIds ?? [];

          const [role, leadPerms] = await Promise.all([
            RoleModel.findOne({ slug: dbUser.role }).lean(),
            getLeadSettings(),
          ]);
          token.permissions = role?.permissions ?? [];
          token.leadPermissions = leadPerms;
        }
      } else if (token.userId) {
        // Periodic re-check: refresh permissions and invalidate if archived
        const now = Date.now();
        const lastCheck = (token.statusCheckedAt as number) ?? 0;
        if (now - lastCheck > 15 * 60 * 1000) {
          await connectDB();
          const dbUser = await UserModel.findById(token.userId, { status: 1, role: 1, seenWhatsNewIds: 1 }).lean();
          if (!dbUser || dbUser.status === "inactive") {
            token.userId = "";
            token.permissions = [];
            token.leadPermissions = [];
          } else {
            // Role-version shortcut: skip the RoleModel lookup when the user's
            // role slug is unchanged. The cached permissions on the token are
            // still valid in that case.
            if (dbUser.role !== token.role) {
              const role = await RoleModel.findOne({ slug: dbUser.role }).lean();
              token.role = dbUser.role;
              token.permissions = role?.permissions ?? [];
            }
            token.leadPermissions = await getLeadSettings();
            token.seenWhatsNewIds = dbUser.seenWhatsNewIds ?? [];
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
      session.user.seenWhatsNewIds = (token.seenWhatsNewIds as string[]) ?? [];
      session.user.image = (token.image as string | null) ?? (token.picture as string | undefined) ?? undefined;
      return session;
    },
  },
});
