# Plan — perf + signout cleanup (tickets #22, #23, #24, #27)

**Branch:** `ticket-22-23-24-27-perf-and-signout-cleanup`
**Status:** planned, not yet implemented
**PR:** to be opened with `Closes #22 #23 #24 #27`

This plan bundles four backlog tickets onto one branch. Sub-plans below
are scoped per ticket so future sessions can pick up any individual
piece.

---

## #22 — Reduce auth/middleware overhead

**Acceptance criteria (from issue)**
- JWT callback skips redundant DB lookups when the cached session is still fresh
- `(app)/layout.tsx` no longer blocks on a heavy `auth()` call for typical navigations
- A `revalidate` strategy is chosen per page type, or it is documented why `force-dynamic` remains correct
- Permission/role changes still take effect within an acceptable window (documented)

**Current state**
`src/auth.ts` already has a 15-minute `statusCheckedAt` freshness window
that skips most DB work. Within each refresh it still re-queries
`RoleModel.findOne({ slug })` and `getLeadSettings()` on every cycle,
even when the role hasn't changed.

**Approach**
- Store `roleSlug` on the JWT token. Skip the `RoleModel` + `getLeadSettings` lookups while `token.roleSlug === user.role`. Only refetch permissions when the role slug actually changes.
- Add a JSDoc above the `jwt` callback explaining the 15-min freshness window AND the role-version shortcut (acceptance criterion "documented window").
- Keep `await auth()` in [src/app/(app)/layout.tsx](../../src/app/(app)/layout.tsx) — it is required to seed `SessionProvider` and, after the optimization above, is a pure in-memory JWT decode on warm tokens. Add an inline comment explaining the cost + the `force-dynamic` rationale.
- No changes to `requirePermission` / `hasPermission`; they are already token-only.

**Files**
- [src/auth.ts](../../src/auth.ts) — `jwt` callback role-version check
- [src/app/(app)/layout.tsx](../../src/app/(app)/layout.tsx) — comment about `auth()` cost + revalidate rationale

**Validation**
- `npm run lint`
- `npm run build`
- Dev: temporary DEBUG log confirms no `RoleModel.findOne` queries fire during a navigation burst within the 15-min window
- JSDoc block present above `jwt` callback

---

## #23 — Trim client bundle + Suspense streaming

**Status note from issue body**
Suspense streaming for `/my-day` and `/dashboard` already shipped via PR
#25. Only the items below remain.

**Approach**
- Add `experimental.optimizePackageImports` in [next.config.ts](../../next.config.ts) for `@tiptap/react`, `@tiptap/starter-kit`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, and `lucide-react`. The icon barrel is by far the biggest tree-shake win.
- Memoize the three pure helpers currently called inline in [src/components/ui/GanttTimeline.tsx](../../src/components/ui/GanttTimeline.tsx) render body: `computeWindow(sections)`, `flattenSections(sections)`, `getMonthSteps(windowStart, windowEnd)`. Wrap in `useMemo` keyed on `[sections, pxPerDay]`. They are pure → safe.
- `src/components/ui/ClientsTimeline.tsx` is already memoized; no changes.
- Lighthouse / DevTools-Performance pass is a manual validation, not a code change.

**Files**
- [next.config.ts](../../next.config.ts)
- [src/components/ui/GanttTimeline.tsx](../../src/components/ui/GanttTimeline.tsx)

**Validation**
- `npm run lint`, `npm run build`
- `next build` output shows lucide-react / tiptap / dnd-kit chunks are sub-export-shaken (not one big barrel)
- DevTools Performance recording on `/my-day` before/after with TTI delta; screenshot in PR

---

## #24 — Tune MongoDB pool + DB hiccup tolerance

**Approach**

[src/lib/mongodb.ts](../../src/lib/mongodb.ts) — explicit connect opts with inline rationale:
- `maxPoolSize: 10` (was Mongoose default 100 — overkill for ~5-person team + many Netlify functions each opening their own pool)
- `minPoolSize: 1` — keep one warm connection
- `serverSelectionTimeoutMS: 5000` (was 30s default — fail fast on Atlas blips instead of hanging full page renders for 30s)
- `socketTimeoutMS: 45000` — for long-running queries

New [src/lib/db-retry.ts](../../src/lib/db-retry.ts):
- `withRetry<T>(fn: () => Promise<T>, { retries?: number, delayMs?: number }): Promise<T>` — retries once on `MongoNetworkError` or `MongoServerSelectionError`, re-throws otherwise. Defaults: `retries: 1`, `delayMs: 200`.

[src/lib/data.ts](../../src/lib/data.ts) — wrap four hottest reads in `withRetry`:
- `getDashboardStats`
- `getActiveProjectsForGantt`
- `getUpcomingEventsForClient`
- `getClientProjectsWithTaskStats`

Skip retry on fire-and-forget activity writes (already swallow errors) and on routes that already retry client-side.

New [src/app/(app)/error.tsx](../../src/app/(app)/error.tsx) — error boundary for the authenticated app group:
- Friendly fallback with "Try again" button (calls `reset()`) and link back to `/dashboard`
- No stack trace shown to end users
- `useEffect` logs error to `console.error` so Netlify functions log captures it

New [src/app/global-error.tsx](../../src/app/global-error.tsx) — last-resort root boundary (Next 15 requires its own `<html>` / `<body>`).

**Files**
- [src/lib/mongodb.ts](../../src/lib/mongodb.ts)
- [src/lib/db-retry.ts](../../src/lib/db-retry.ts) — new
- [src/lib/data.ts](../../src/lib/data.ts)
- [src/app/(app)/error.tsx](../../src/app/(app)/error.tsx) — new
- [src/app/global-error.tsx](../../src/app/global-error.tsx) — new

**Validation**
- `npm run lint`, `npm run build`
- `withRetry` smoke test: simulate `MongoNetworkError`, confirm exactly 2 attempts; non-transient error → 1 attempt + re-throw
- Hit a deliberately broken route (e.g. invalid client id) → `(app)/error.tsx` renders instead of a white screen

---

## #27 — Fix sign out on production

**Diagnosed root cause**
`trustHost: true` is set in [src/auth.config.ts](../../src/auth.config.ts), but NextAuth 5 reads `AUTH_URL` / `AUTH_TRUST_HOST` from env in production to derive the cookie domain and CSRF origin. On Netlify only `APP_URL` is set today. Without `AUTH_URL` the POST to `/api/auth/signout` fails the CSRF/host check, cookies are never cleared, then `window.location.href = "/login"` immediately picks up the still-valid session and redirects back into the app — exactly the "sign out does nothing" symptom.

**Approach**
- [src/auth.config.ts](../../src/auth.config.ts) — add an explicit `cookies` config with the default NextAuth names (`__Secure-authjs.session-token` in prod via `useSecureCookies` auto-detect) for deterministic behavior. Keep `trustHost: true` as belt-and-braces fallback.
- [CLAUDE.md](../../CLAUDE.md) — extend the env-vars section:
  - Add `AUTH_URL` (required in prod; `https://app.example.com`, no trailing slash)
  - Add `AUTH_TRUST_HOST=true` (Netlify belt-and-braces)
  - Short note: without `AUTH_URL`, sign-out works on localhost but silently fails on production.
- The actual prod fix is setting `AUTH_URL` on Netlify → Site settings → Environment variables. PR description must call this out as a manual step; the code change alone does not fix production.

**Files**
- [src/auth.config.ts](../../src/auth.config.ts)
- [CLAUDE.md](../../CLAUDE.md)

**Validation**
- `npm run lint`, `npm run build`
- Localhost regression: sign-out still lands on `/login` with cleared cookies
- After deploy with `AUTH_URL` set on Netlify: sign-out lands on `/login`, session is cleared (cookies empty, no auto-redirect back into the app)
- Root cause + manual Netlify env steps documented in PR description

---

## Combined notes

**Release notes** — single entry "Snellere pagina-renders + betere fout-afhandeling" with the sign-out fix as the first user-visible bullet.

**End-to-end verification**
1. `npm run dev` — login, dashboard, my-day; no UX regressions
2. `npm run lint`
3. `npm run build` — bundle-analyzer output checked
4. Deploy to Netlify preview → hard refresh → sign-out test (after setting `AUTH_URL`!)
5. Tick all acceptance criteria + validation checks on each issue, then open the PR
