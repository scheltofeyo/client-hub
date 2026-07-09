import NextAuth from "next-auth";
import { cache } from "react";
import { authConfig } from "./auth.config";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { RoleModel } from "@/lib/models/Role";
import { TaskModel } from "@/lib/models/Task";
import { ProjectModel } from "@/lib/models/Project";
import { getLeadSettings } from "@/lib/models/LeadSettings";
import { withRetry } from "@/lib/db-retry";

/**
 * DB work for the periodic token re-check, kept off the render-blocking path:
 * transient errors retry once (withRetry) and the whole thing is raced against
 * a hard timeout so a cold Atlas connection can never stall first byte for
 * more than REFRESH_TIMEOUT_MS.
 */
const REFRESH_TIMEOUT_MS = 3000;

async function fetchTokenClaims(userId: string) {
  return withRetry(async () => {
    await connectDB();
    const dbUser = await UserModel.findById(userId, { status: 1, role: 1, seenWhatsNewIds: 1 }).lean();
    if (!dbUser || dbUser.status === "inactive") return null;
    const [role, leadPerms] = await Promise.all([
      RoleModel.findOne({ slug: dbUser.role }).lean(),
      getLeadSettings(),
    ]);
    return { dbUser, role, leadPerms };
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Token refresh timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

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
     *     Within the window: zero DB. At the boundary: re-read user + role +
     *     leadSettings to pick up any permission changes (admin editing a
     *     Role's permissions, leadSettings flips, status flips).
     *
     * The boundary re-check is stale-while-revalidate: it retries once on
     * transient errors and is raced against REFRESH_TIMEOUT_MS. On timeout or
     * failure we keep the existing token claims and leave `statusCheckedAt`
     * un-bumped so the next request retries. This means the first request of
     * the day never blocks first byte on a cold Atlas connection for more
     * than ~3s. Security-wise: under normal DB availability, deactivated
     * users still lose access within ≤15 min + one request. The deliberate
     * tradeoff is a DEGRADED-but-up DB: while Atlas consistently answers
     * slower than REFRESH_TIMEOUT_MS (but within the 5s serverSelectionTimeout,
     * so data routes still work), every re-check times out and a deactivated
     * user / revoked role keeps its stale claims for the duration of the
     * degradation — each request retries, and the first sub-timeout response
     * propagates the revocation. During a full DB outage exposure is nil,
     * since every data-bearing page and API route fails anyway. Accepted
     * (availability over instant revocation) for our team size.
     *
     * RSC nuance: a token mutated during a server-component render cannot be
     * persisted back into the cookie (cookies can't be set mid-render), so
     * `statusCheckedAt` only durably advances when the JWT callback runs in a
     * route-handler context — in practice the /api/auth/session fetch from
     * SessionProvider after hydration. That call is off the paint path.
     *
     * Permission / role changes take effect on the next refresh after the
     * 15-minute boundary (worst case ~15 min latency). This is documented in
     * CLAUDE.md and acceptable for our team size.
     *
     * Note: a previous version tried to skip the RoleModel fetch when the
     * user's role slug was unchanged, but that broke permission propagation
     * when an admin added/removed a permission on a role (the role slug stays
     * the same so the cached permissions on the token never refreshed). We
     * accept the tiny cost of one indexed lookup per 15-min window per user
     * in exchange for correct propagation.
     */
    async jwt({ token, account, trigger, session }) {
      // Defensive: when Auth.js triggers signOut, return null so no token is
      // re-encoded into the response cookie. The TypeScript union doesn't
      // include "signOut" but Auth.js v5 may pass it at runtime; the cast is
      // intentional. Without this, the existing token would be returned and
      // Auth.js would Set-Cookie it back into the response, undoing the
      // signout (last Set-Cookie wins).
      if ((trigger as string) === "signOut") {
        return null;
      }

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
          // Claims are fresh as of right now — without this the very first
          // RSC render after login crosses the (lastCheck = 0) boundary and
          // immediately re-pays the DB re-check it just performed.
          token.statusCheckedAt = Date.now();
        }
      } else if (token.userId) {
        // Periodic re-check: refresh permissions and invalidate if archived
        const now = Date.now();
        const lastCheck = (token.statusCheckedAt as number) ?? 0;
        if (now - lastCheck > 15 * 60 * 1000) {
          try {
            const claims = await withTimeout(fetchTokenClaims(token.userId as string), REFRESH_TIMEOUT_MS);
            if (!claims) {
              token.userId = "";
              token.permissions = [];
              token.leadPermissions = [];
            } else {
              // Always refetch role + leadSettings so that admin-side changes to
              // a role's permissions (or to leadSettings) propagate within the
              // 15-min window even when the user's role slug is unchanged.
              token.role = claims.dbUser.role;
              token.permissions = claims.role?.permissions ?? [];
              token.leadPermissions = claims.leadPerms;
              token.seenWhatsNewIds = claims.dbUser.seenWhatsNewIds ?? [];
            }
            token.statusCheckedAt = now;
          } catch {
            // DB cold, slow, or down: keep the existing token claims and do NOT
            // bump statusCheckedAt, so the next request retries against what is
            // by then a warm connection. See the doc comment above for why this
            // stale-while-revalidate fallback is acceptable.
          }
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

/**
 * Request-scoped `auth()` for server components. A layout and its page render
 * in the same pass and each need the session; calling `auth()` twice runs the
 * jwt callback twice — on the 15-min re-check boundary that means two
 * serialized DB round-trip chains before first byte. React cache() collapses
 * them into one per request. Route handlers and server actions can keep
 * calling `auth()` directly (they run once per request anyway).
 */
export const getSession = cache(() => auth());
