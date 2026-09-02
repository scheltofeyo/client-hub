# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000 (uses --max-old-space-size=4096)
npm run build     # Production build
npm run lint      # ESLint
```

There is no test suite configured yet.

## Stack

- **Next.js 15** (App Router, `src/` directory, `@/*` alias)
- **TypeScript**
- **MongoDB** via Mongoose 9 — connection in `src/lib/mongodb.ts`
- **NextAuth 5** (beta) — Google OAuth, JWT sessions
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)
- **Lucide React** for icons
- **Netlify** for deployment (`@netlify/plugin-nextjs`)

## Environment Variables

Required in `.env.local`:
- `MONGODB_URI` — MongoDB Atlas connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `AUTH_SECRET` — NextAuth secret
- `GAS_FOLDER_WEBHOOK_URL` — Google Apps Script web app URL (must be `/macros/s/.../exec` format, not `/a/macros/domain/...`)
- `GAS_FOLDER_WEBHOOK_SECRET` — Shared secret matching `WEBHOOK_SECRET` in GAS Script Properties
- `APP_URL` — Production URL (HTTPS, no trailing slash) — used as the GAS callback base URL

Required in production (Netlify) on top of the above:
- `AUTH_URL` — Production URL (HTTPS, no trailing slash, same value as `APP_URL`). Auth.js 5 uses this to derive the cookie domain and CSRF origin. **Without it sign-out works on localhost but fails silently in production**: the POST to `/api/auth/signout` is rejected by the CSRF check, cookies stay set, and the post-signout redirect to `/login` immediately picks up the still-valid session and bounces back into the app.
- `AUTH_TRUST_HOST=true` — belt-and-braces for Netlify's reverse-proxy setup. The code config also sets `trustHost: true` but the env var is what Auth.js consults first.

All eight env vars must be set in Netlify → Site settings → Environment variables for production to work correctly.

## Architecture

### App structure

```
src/
  app/
    layout.tsx                  # Root HTML shell — dark mode init script, metadata
    (app)/layout.tsx            # Protected group — SessionProvider, three-column shell
    (app)/my-day/               # Personal dashboard — overdue tasks, follow-ups, Gantt for led clients
    (app)/dashboard/            # Team/org stats overview
    (app)/clients/              # Client list table
    (app)/clients/[id]/         # Client detail — tabs: Dashboard, Projects, Tasks, Sheets, Logbook, Events, Activity, Settings
    (app)/clients/[id]/projects/[projectId]/  # Project detail — layout with ProjectTertiaryNav, overview + tasks + files tabs
    (app)/admin/                # Admin panel — employees, archetypes, services, signals, templates, reference data
    (app)/admin/employees/[id]/ # Tabbed employee editor (personal, employment, permissions)
    (app)/admin/templates/      # Project template editor with TemplateTask management
    (app)/admin/stylesheet/     # Visual reference page — renders all button variants and task row states using real components
    (app)/profile/              # Self-service profile editing (reuses EmployeeDetailEditor in "self" mode)
    (app)/settings/             # App info + release notes display
    (app)/tools/                 # Tools landing — permission-gated tool grid (Team, Workshops categories)
    (app)/tools/team/            # Holiday Planner — calendar + balances tabs (requires team.viewCalendar)
    (app)/tools/ranking/         # Ranking the Values — session CRUD, rich text editor (requires tools.ranking.access)
    (app)/tools/surveys/         # Surveys — session list, editor, runner preview, results (requires tools.surveys.access)
    (app)/admin/surveys/         # Survey template editor (requires admin.surveys.manageTemplates)
    s/[clientSlug]/[shareCode]/  # Public survey runner — outside (app), no login
    (app)/projects/             # Cross-client project list
    api/                        # Route handlers (see API layer below)
  components/
    layout/                     # Shell components (nav, panels, header)
    ui/                         # Feature components (tabs, forms, shared primitives)
    my-day/                     # My Day dashboard components (tasks, follow-ups, projects/Gantt, user card)
    team/                       # Holiday Planner components (HolidayCalendar, BalancesTable)
    surveys/                    # Survey editor shell, question forms, block menu, configure sheet
    survey-results/             # Results tab, question cards, result types
    charts/                     # visx chart primitives shared by results views
  lib/
    mongodb.ts                  # Global Mongoose connection (singleton, dev-safe)
    data.ts                     # Server-side data helpers with React cache() deduplication
    activity.ts                 # recordActivity() — non-critical audit trail helper
    utils.ts                    # Shared helpers: fmtDate, daysAgo, timeAgoLabel
    permissions.ts              # Permission registry — all permission strings + groups
    auth-helpers.ts             # hasPermission, hasLeadPermission, requirePermission, contextual checks
    models/                     # Mongoose models (see Data Models below)
  hooks/
    usePermission.ts            # Client-side permission hooks
  types/index.ts                # All shared TypeScript interfaces
  auth.ts / auth.config.ts      # NextAuth callbacks + edge-safe config
```

### UI layout

Three-column layout within `(app)/layout.tsx`:
1. **IconNav** (`w-14`) — icon-only sidebar, far left
2. **PanelNav** (`w-56`) — contextual second panel. Becomes **ClientPanelNav** on client pages, **AdminPanelNav** on admin pages, **ToolsPanelNav** on tools landing
3. **Main** (`flex-1`) — scrollable page content

Right-side slide-in panel is managed by **RightPanel** context (`src/components/layout/RightPanel.tsx`) — used for task forms, log forms, event forms, etc.

### Client components

Most pages are server components. These are `"use client"`:
- All layout nav components (need `usePathname`, `useSession`)
- All tab/feature UI components (need state, events, fetch)
- `ThemeToggle`, `UserMenu`

Do not add event handlers to server components — use the `.hover-row` CSS class from `globals.css` instead.

### PageHeader and tertiary nav

`src/components/layout/PageHeader.tsx` is the standard page header used on all pages. Props:
- `breadcrumbs` — array of `{ label, href? }`. Items without `href` render as unclickable text (last crumb is always unclickable).
- `title` — h1 text
- `actions` — optional ReactNode rendered top-right (buttons, etc.)
- `tertiaryNav` — optional ReactNode rendered below the title row; when provided, the bottom border moves to the nav instead of the header

`ProjectTertiaryNav` and `AboutTertiaryNav` are tab bars that slot into `tertiaryNav`. Pass `basePath` to them so active-state detection works correctly.

### Shared task row primitives

`src/components/ui/task-row.tsx` is the single source of truth for task list rendering. Both `TasksTab` (project-scoped) and `ClientTasksTab` (client-wide) import from here. It exports:

- `TaskRow` — main task row with chevron/subtask slot, checkbox, kebab menu. Callback-based: no API calls inside.
- `SubtaskRow` — same pattern for nested tasks
- `InlineTaskInput` — keyboard-driven inline task creation
- `TaskForm` — right-panel form for creating/editing tasks (handles both client-level and project-level endpoints depending on whether `projectId` is provided)
- `AssigneeAvatars`, `UserOption`, `fmtDate`

When `task.logId` is set, `TaskRow` shows a "Follow up:" prefix + book icon. Pass `onViewInLogbook` to replace the kebab Delete option with "View in logbook".

## Data Models

All in `src/lib/models/`. Models delete and recompile on hot reload (dev pattern — do not remove the `deleteModel` guards).

| Model | Purpose |
|---|---|
| `User` | googleId, googleName, googleImage, displayName, displayImage, firstName/preposition/lastName, role (slug), status (`invited`\|`active`\|`inactive`), employment fields (dateStarted, contractType, etc.), invitedBy/invitedAt. Auto-computed `name` (displayName > googleName > structured parts) and `image` (displayImage > googleImage) |
| `Role` | name, slug, description, permissions[], isSystem, rank — role-based access control |
| `Client` | company, status, platform, contacts[], leads[], archetypeId, folderStatus (`pending`\|`ready`) |
| `Project` | clientId, title, status, completedDate, soldPrice, templateId, serviceId, labelId |
| `Task` | clientId?, projectId?, parentTaskId (subtasks), logId (follow-up link), assignees[], completedAt |
| `Log` | clientId, contactIds[], summary, signalIds[], followUp, followUpDeadline |
| `ClientEvent` | clientId, title, date, type, recurrence, repetitions?, notes — custom timeline events |
| `ActivityEvent` | clientId, actorId, actorName, type, metadata — written by `recordActivity()` |
| `Sheet` | clientId, name, url — Google Sheets/docs linked to a client |
| `Archetype` | name, rank |
| `Service` | name, rank |
| `LogSignal` | name, rank |
| `EventType` | slug, label, color, icon, rank — configurable event type palette |
| `ClientStatusOption` | slug, label, rank — configurable client status values |
| `ClientPlatformOption` | slug, label, rank — configurable client platform values |
| `ProjectLabel` | name, rank — configurable project label values |
| `ProjectTemplate` | name, defaults for new projects |
| `TemplateTask` | templateId, parentTaskId (subtasks), title, assignToClientLead, order |
| `LeadSettings` | Singleton — configurable lead permissions per role (defaults: clients.edit, projects.create/edit/kickoff) |
| `LeaveType` | name, rank — configurable leave categories (sick, personal, etc.) |
| `TimeOff` | userId, leaveTypeId, date, hours — individual time-off entries |
| `CompanyHoliday` | name, date — company-wide holidays shown on team calendar |
| `OAuthClient` | clientId, clientName, redirectUris[], tokenEndpointAuthMethod — an app that may ask for consent, usually self-registered via DCR |
| `OAuthGrant` | userId, clientId, clientName, scopes[], resource, accessTokenHash, refreshTokenHash, revokedAt — one row per live connection, rotated in place |
| `OAuthAuthCode` | codeHash, userId, clientId, redirectUri, scopes[], codeChallenge, expiresAt (TTL), usedAt — single-use authorization code |
| `RankingSession` | clientId, title, values[], culturalLevels[], status (`draft`\|`open`\|`closed`\|`archived`), shareCode — workshop value-ranking sessions |
| `RankingSubmission` | sessionId, participantName, rankings[] — participant responses to ranking sessions |
| `SurveyTemplate` | name, description, status, archetypeIds[], defaultRankWeights/Top3Weights, defaultThankYouText, defaultWelcomeScreen, defaultRespondentVariable — reusable survey blueprint |
| `SurveyTemplateSection` | templateId, title, description, imageUrl, openQuestion, order — chapter inside a template |
| `SurveyTemplateQuestion` | templateId, sectionId, type, title, options/rankingItems/choices/scale/assessmentPrompt/valueItems, order — one question block |
| `SurveySession` | clientId, templateId, templateSnapshot (frozen copy of the whole template incl. `culturalValues`/`culturalLevels`/`welcomeScreen`), respondentVariable, analyses[], status (`draft`\|`open`\|`closed`\|`archived`), shareCode |
| `SurveySubmission` | sessionId, email, answers[], cohortTags (Map — the respondent variable), completedAt — one participant response |

Reference data models (Archetype, Service, LogSignal, EventType, ClientStatusOption, ClientPlatformOption, ProjectLabel) all support `rank` and a `/reorder` POST endpoint for drag-to-reorder in the admin UI.

**Task scope:** `projectId` is optional on Task — tasks exist at both project scope (`/api/clients/[id]/projects/[projectId]/tasks`) and client scope (`/api/clients/[id]/tasks`). The `logId` field links follow-up tasks generated from log entries.

## API Layer

RESTful nesting under `src/app/api/`:

```
/api/clients                        GET (list), POST (create)
/api/clients/[id]                   PATCH, DELETE
/api/clients/[id]/activity          GET — live join with UserModel for current images
/api/clients/[id]/logs              GET, POST
/api/clients/[id]/logs/[logId]      PATCH, DELETE
/api/clients/[id]/projects          GET, POST
/api/clients/[id]/projects/[id]     PATCH, DELETE
/api/clients/[id]/projects/[id]/tasks         GET, POST
/api/clients/[id]/projects/[id]/tasks/[id]    PATCH, DELETE
/api/clients/[id]/tasks             GET, POST  — client-level tasks (no project)
/api/clients/[id]/tasks/[taskId]    PATCH, DELETE
/api/clients/[id]/events            GET, POST  — custom timeline events
/api/clients/[id]/events/[eventId]  PATCH, DELETE
/api/clients/[id]/sheets            GET, POST
/api/clients/[id]/sheets/[id]       DELETE
/api/archetypes                     GET, POST + /reorder
/api/services                       GET, POST + /reorder
/api/log-signals                    GET, POST + /reorder
/api/event-types                    GET, POST + /reorder + /[id]
/api/client-statuses                GET, POST + /reorder + /[id]
/api/client-platforms               GET, POST + /reorder + /[id]
/api/project-labels                 GET, POST + /reorder + /[id]
/api/project-templates              GET, POST
/api/project-templates/[id]         PATCH, DELETE
/api/project-templates/[id]/tasks           GET, POST
/api/project-templates/[id]/tasks/[taskId]  PATCH, DELETE
/api/roles                          GET, POST
/api/roles/[id]                     GET, PATCH, DELETE
/api/roles/reorder                  POST
/api/permissions                    GET — grouped permission list for admin UI
/api/users                          GET, POST
/api/users/[id]                     GET, PATCH
/api/users/assignable               GET — users eligible for task assignment
/api/leave-types                    GET, POST + /reorder + /[id]
/api/time-off                       GET, POST
/api/time-off/[id]                  PATCH, DELETE
/api/time-off/balances              GET — per-user leave balance summaries
/api/company-holidays               GET, POST
/api/company-holidays/[id]          PATCH, DELETE
/api/ranking-sessions               GET, POST
/api/ranking-sessions/[id]          PATCH, DELETE
/api/ranking-sessions/[id]/submissions  GET, POST
/api/surveys/templates              GET, POST
/api/surveys/templates/[id]         GET, PATCH, DELETE + /usage
/api/surveys/templates/[id]/sections            GET, POST + /[sectionId] PATCH, DELETE
/api/surveys/templates/[id]/questions           GET, POST + /[questionId] PATCH, DELETE
/api/surveys/sessions               GET, POST — POST materialises the template snapshot
/api/surveys/sessions/[id]          GET, PATCH, DELETE
/api/surveys/sessions/[id]/results  GET — computed results, `?segment=` filters by respondent variable
/api/surveys/sessions/[id]/submissions          GET
/api/surveys/sessions/[id]/analyses             GET, POST + /reorder + /[aid]
/api/surveys/sessions/[id]/export   GET — markdown export
/api/public/surveys/[shareCode]     GET — participant view of an open session (no auth)
/api/public/surveys/[shareCode]/start   POST — identify + respondent variable
/api/public/surveys/[shareCode]/save    POST — autosave partial answers
/api/public/surveys/[shareCode]/submit  POST — final submit
/api/mcp                            POST — remote MCP server (see below)
/api/oauth/register                 POST — dynamic client registration (RFC 7591)
/api/oauth/authorize                POST — consent decision → authorization code
/api/oauth/token                    POST — authorization_code + refresh_token grants
/api/oauth/revoke                   POST — token revocation (RFC 7009)
/api/oauth/grants                   GET — your own connected apps
/api/oauth/grants/[id]              DELETE — disconnect an app
/.well-known/oauth-protected-resource      GET — RFC 9728 (rewritten to /api/oauth/)
/.well-known/oauth-authorization-server    GET — RFC 8414 (rewritten to /api/oauth/)
```

All routes call `auth()` and return 401/403 as appropriate. Permission checks use `requirePermission(session, "permission.key")` or `hasPermission(session, "permission.key")` from `src/lib/auth-helpers.ts`. Contextual checks (lead-based, creator-based) combine with permissions via `hasPermissionOrIsLead()` / `hasPermissionOrIsCreator()`.

Permissions are loaded into the JWT/session on login from the `Role` model. The permission registry in `src/lib/permissions.ts` defines all valid permission strings. Role changes take effect on next login.

### Lead permissions

The session carries two permission sets: `permissions` (global) and `leadPermissions` (apply only when the user is a lead on the client). `LeadSettings` (singleton model) defines which permissions leads get. API routes use `hasPermissionOrIsLead(session, permission, client.leads)` to combine both checks. `LEAD_ELIGIBLE_PERMISSIONS` in `permissions.ts` defines which permissions can be granted as lead permissions.

### Employee management & invitation flow

Users must be invited (via admin) before they can log in. `POST /api/users` creates a User with `status: "invited"`. On first Google OAuth login, the user auto-activates if their email matches an invited record. Admin can set display name/image overrides, employment details, and role. The profile page (`/profile`) lets users edit their own personal details using the same `EmployeeDetailEditor` component.

**Exception:** `/api/internal/` routes are excluded from the auth middleware (`auth.config.ts`) and are secured by shared secret instead. Do not add `auth()` calls to these routes. The `/ranking/[shareCode]` and `/s/[clientSlug]/[shareCode]` pages are also public (outside the `(app)` group), together with `/api/public/` — participants access them without logging in.

`/api/mcp`, `/api/oauth/` and `/.well-known/` are also excluded from the middleware gate, but for the opposite reason: they authenticate themselves and must be able to answer `401` (or an OAuth error) rather than be redirected to `/login`, which a non-browser caller cannot follow. The `/oauth/authorize` consent *page* stays gated — it is the one step that requires a signed-in browser.

```
/api/internal/folder-callback   POST — called by GAS after Drive folder creation
/api/clients/[id]/folder-status GET — polled by FolderPendingBanner every 4s
```

## Key Patterns

### User images
`User.image` (Google profile photo URL) is refreshed on every login. To keep list endpoints fast, denormalized snapshots — like `Task.assignees[].image` — are the source of truth at read time; **do not** do live `UserModel.find` lookups inside list endpoints. Freshness is maintained by the `signIn` callback in `src/auth.ts`, which bulk-updates those snapshots (e.g. `TaskModel.updateMany` with `arrayFilters`) whenever the user's Google image changes. Writers (task POST/PATCH, etc.) must include the current `image` when storing an assignee/contact. The shared `UserAvatar` component (`src/components/ui/UserAvatar.tsx`) is used everywhere. Props: `name`, `image`, `size` (px, default 24).

When introducing a new place where a user's image is denormalized, extend the `signIn` propagation so image updates flow through on next login.

### Activity recording
`recordActivity()` in `src/lib/activity.ts` is fire-and-forget (errors are swallowed). Call it after any meaningful mutation.

### React cache() deduplication
`src/lib/data.ts` wraps DB queries in React `cache()` — a single server render that calls `getClientById()` from both the layout and the page component only hits the DB once.

### Task completion → project status
When tasks are completed or deleted, the tasks API recalculates and updates the parent project's status automatically (`not_started` / `in_progress` / `completed`).

### Google Drive folder creation

When a client is created with "Create Google Drive folder" checked, `POST /api/clients` sets `Client.folderStatus: "pending"` and calls the GAS webhook. The GAS script (`gas/folder-webhook.js`, git-ignored) creates the full folder + sheet structure in Drive, then POSTs back to `/api/internal/folder-callback` with the sheet URLs. The callback saves `Sheet` docs and sets `folderStatus: "ready"`. `FolderPendingBanner` polls `/api/clients/[id]/folder-status` every 4s until ready.

The GAS web app must be deployed with **Execute as: Me**, **Who has access: Anyone**. The URL must use the `/macros/s/.../exec` format — the `/a/macros/domain/` format is domain-restricted and returns 401 for unauthenticated server calls.

### Events timeline
The Events tab renders a unified `TimelineEvent[]` that merges four sources: `log_followup` (from Log records with followUp=true), `task` (tasks with a completionDate), `project` (project milestones), and `custom` (ClientEvent records). The API assembles these server-side; `EventsTab.tsx` only renders the merged list. Custom events support recurrence (`none | weekly | biweekly | monthly | quarterly | yearly`) with optional `repetitions` cap.


### Survey engine

Templates are blueprints; a **session** is the thing participants fill in. Creating a session copies
the entire template into `SurveySession.templateSnapshot` — sections, questions, cultural values,
levels, thank-you text. Nothing is looked up live afterwards, so editing or deleting a template can
never rewrite a survey people have already answered. The one deliberate exception is
`enrichArchetypes()` (`src/lib/surveys/enrich-archetypes.ts`), which does resolve archetype ids
against the global `Archetype` collection so renames propagate — archetypes are org-wide reference
data, cultural values are client-owned free text.

**Question types** (`SURVEY_QUESTION_TYPES` in `src/lib/surveys/types.ts`) — `archetype-ranking`,
`archetype-top3`, `general-ranking`, `general-top3`, `multiple-choice`, `open-text`, `scale`,
`value-assessment`, `value-ranking`, `intro`. Adding one means touching a known list of files:
the two models (`SurveyTemplateQuestion`, `SurveySession`) plus `SurveySubmission` for the answer
shape, then `types.ts`, `question-validation.ts`, `answer-validation.ts`, `serializers.ts`,
`distributions.ts`, `compute-results.ts`, `export-markdown.ts`, and on the UI side
`components/surveys/question-types.ts`, `AddBlockMenu.tsx`, `QuestionForm.tsx` and
`survey-results/QuestionCard.tsx`. Missing one of these fails quietly rather than loudly — a question
that renders but never appears in results.

**Client-independent templates.** `value-assessment` and `value-ranking` carry **no items in the
template**. Their `valueItems` are materialised at session creation from the chosen client's
`culturalDna` (`src/lib/surveys/cultural-dna.ts`, `CULTURAL_SELECT` for the `.select()`). That is
what lets one template serve a client with three values and a client with eight. Never author
`valueItems` into a template or a seed script.

**Welcome and closing copy.** The participant welcome screen is authored per template
(`SurveyTemplate.defaultWelcomeScreen`, copied into `templateSnapshot.welcomeScreen` at session
creation) and edited under *Welcome screen* in the editor outline. `src/lib/surveys/welcome-screen.ts`
owns the shape and both directions of the fallback: every field is an *override*, and an absent or
blank one renders the built-in translation, which is what keeps an untouched survey bilingual under
the runner's NL/EN switch. The editor prefills each field with `defaultWelcomeCopy()` and stores only
text that actually differs, so "cleared" and "never set" are the same stored state. `bodyIntro` is one
field carrying two default paragraphs; `welcomeParagraphs()` splits it on blank lines at render time,
so authors are not made to count paragraph slots. The email field, the time estimate and the start
button stay on the translations — mechanics rather than message, and they should follow the
participant's own language even on a survey whose copy is authored in one.

`autoGreeting` is the one non-string field. Absent means the rotating greeting from `greetings.ts`
is used and the two headline fields are hidden in the editor; `false` swaps in the authored pair.
`resolveWelcomeCopy()` withholds the greeting entirely in that case, otherwise an author who turns
the toggle off and leaves a headline on its default would silently get the rotation back. Authored
lines survive toggling either way. `thankYouText` is the same arrangement for the closing screen,
minus the per-field structure.

**The respondent variable** is one attribute answered before the value questions that both *selects
content* (which behaviours a participant sees for each value) and *slices results*. Stored on the
session as `respondentVariable`, answered into `SurveySubmission.cohortTags`. Cultural Level is the
first instance; the mechanism is generic. `effectiveRespondentVariable()` derives one when a session
has value-backed questions but no stored config — without a level those questions would silently show
every level's behaviours at once, which is wrong in a way nobody notices before a training. Levels are
free text typed twice (once on the client, once per behaviour), so `normalizeLevel()` / `levelsMatch()`
trim both sides of the join; skipping that shows a participant no behaviours at all.

**Results.** `compute-results.ts` builds `QuestionResult`s from accumulators in `distributions.ts`.
Two rules that are easy to get wrong:
- Ordinal answers use `computeScaleStats()` from `dispersion.ts`, **not** `agreement.ts`. Entropy
  cannot tell "half answered 1, half answered 5" from "everyone answered 3 or 4"; for a
  self-assessment that difference is the whole conversation.
- `value-ranking` reports **mean rank position** (`meanRankFromDistribution()`), never weighted
  points. `rankWeights` is five long by default, so with six or more values every position past the
  fifth would score zero and flatten the tail.

`segments.ts` lists and filters by the respondent variable; a level nobody answered is still listed
(so the UI can say so) but is not `selectable`. `?segment=` on the results route filters submissions
before computation.

**Seeding templates.** `scripts/seed-*.ts` upsert on title so section and question IDs survive a
re-run and live sessions keep working. Each language is its own template — the participant page
translates only its own chrome (`src/lib/surveys/translations.ts`), never template content. The
Cultural Self-Assessment keeps both languages in one script (`npm run seed:cultural-assessment` /
`:cultural-assessment-en`); the older archetype survey predates that and has one file per language.

### Remote MCP server

`POST /api/mcp` exposes the hub to Claude clients over the Model Context Protocol. Stateless request/response only: one JSON-RPC 2.0 object in, one out. No SSE stream (`GET` returns 405), no `Mcp-Session-Id`, no dependencies — a tool-only server has nothing to push, and a long-lived stream sits badly with Netlify's function limits.

- **Transport** — `src/app/api/mcp/route.ts`. Hand-rolled JSON-RPC dispatch.
- **Tools** — `src/lib/mcp/tools.ts`. One registry of `{ name, description, inputSchema, permission?, handler }`.
- **Protocol constants and helpers** — `src/lib/mcp/protocol.ts`.

**Dual-era.** MCP revision `2026-07-28` replaced the `initialize` handshake with per-request `_meta` plus a mandatory `server/discover`, and clients are still split across both styles, so the server answers both and reads the era off each request. Two things are required on the modern revision and rejected by clients if missing: `resultType: "complete"` on `tools/list` and `tools/call`, and caching hints (`ttlMs`, `cacheScope`) on cacheable results. `tools/list` must stay `cacheScope: "private"` — it is filtered per caller, and `"public"` would let a shared cache serve one token's tool list to another.

**Auth and permissions.** Two credentials reach the same code path, told apart by prefix: the personal API token (`Bearer shub_…`) and an OAuth access token (`Bearer shubo_…`, see below). `auth()` resolves either into a real `Session`, so no MCP-specific auth exists. Each tool declares the permission its underlying action already requires, `tools/list` shows only the tools the caller may use, and `tools/call` re-checks before doing any work so a refusal can never leave a partial write. The endpoint itself needs no permission — it grants nothing a credential holder doesn't already have over REST.

**Lead-eligible tools.** `clients.edit` is a lead permission: someone who leads a client may edit that client without holding the permission globally. A flat `hasPermission` check in the registry would hide those tools from them entirely, so `McpTool` carries a `leadEligible` flag and `mayUseTool()` also accepts a lead permission. That gate is deliberately coarse — it only decides whether the tool is listed and callable at all. *Which* client may be touched is decided inside the handler by `requireClientForWrite()`, with that client's own `leads` array in hand, and before any write. Do not tighten the registry gate to compensate: a lead has no global permission to check against there.

**Errors.** A problem the model can act on (bad id, unknown column, missing permission) returns a tool result with `isError: true` and a readable sentence. JSON-RPC errors are reserved for protocol faults. Never let an exception's stack reach the client.

**Shared writes.** Tool handlers must go through `createClient()` / `updateClient()` and the contact helpers (`src/lib/clients.ts`), `createLogEntry()` (`src/lib/logs.ts`), `createSalesCard()` / `moveSalesCard()` / `updateSalesCard()` (`src/lib/sales.ts`) and `createTask()` / `updateTask()` (`src/lib/tasks.ts`) — the same helpers the REST routes call. That keeps behaviour identical across surfaces and keeps the "via" attribution working, since `creatorFields()` and `recordActivity()` read the token off the request themselves.

`src/lib/clients.ts` also owns the two guards the client-create tool needs and the form does not: `resolveClientReferenceData()` (status and platform are `ClientStatusOption` / `ClientPlatformOption` slugs, not free text) and `findDuplicateClients()` (`company` carries no unique index, and a caller who cannot see the client list has no other way to notice). They are exported but called only from the MCP tool — the form offers configured options in a `<select>` and shows the existing clients behind it, so wiring them into `POST /api/clients` would change its behaviour to catch nothing. `resolveArchetype()` is a third of the same kind, separate because `Archetype` carries no slug — only a unique name — so the id is what gets stored and the name is all a caller can have said.

`updateClient()` is the opposite case: `PATCH /api/clients/[id]` always ran this logic, so the whole handler moved into the helper and the route now calls it. The contact helpers (`addClientContact()`, `updateClientContact()`, `removeClientContact()`) sit on top of it rather than beside it. The hub sends the entire contacts array on every change — it holds the list in React state, so that is free and safe — but asking a model to resend every contact in order to add one makes dropping a colleague the plausible outcome of a single forgotten line. Each helper reads the stored array, changes exactly one entry and hands the result to `updateClient()`, so the permission check and the `contact.changed` event still happen in one place.

`src/lib/sales.ts` owns one guard on the same terms: `findOpenCardForClient()`. Nothing server-side stops a client having two open cards on the same board, and the hub does not need it to — `AddProspectPicker` is handed the board's open cards and greys out a prospect already on it. A model that has not read the board first has no such protection, so `create_sales_card` checks before it writes and takes `allowDuplicate` for a second card that is genuinely wanted.

`src/lib/tasks.ts` additionally owns `recalcProjectStatus()` and `canEditTask()`. The latter is exported because the follow-up exemption (anyone may tick off a log-derived follow-up, but only the completion toggle) is the rule most likely to be reimplemented slightly differently on a new surface — and a slightly different version of it is a hole. A caller writing several tasks at once must check them all with it *before* writing any, so a refusal cannot leave a partial write.

**No CORS headers, deliberately.** The spec's `Origin` rule targets cookie-authenticated localhost servers; this one takes a bearer token a web page cannot mint, and withholding CORS stops a page reading the response cross-origin. Do not add `Access-Control-Allow-Origin`.

**Connecting a Claude client** — nothing to install:

```bash
claude mcp add --transport http summ-hub https://<APP_URL>/api/mcp \
  --header "Authorization: Bearer shub_..."
```

Generate the token under the API tokens section of the employee/profile page. For an unattended scheduled task, narrow the token to just the permissions it needs — a token scoped to `logs.create` sees only the logbook tools.

Omit the header and the same command runs the OAuth flow instead, which is what the Claude app's custom connectors do.

### OAuth — the hub as its own authorization server

The Claude app's custom connectors offer no field for a static bearer token, so
the hub is also an OAuth 2.1 authorization server. The MCP spec allows the
authorization server to sit beside the resource server, and hosting it here means
the user step is the Google login the team already has — no extra service, no
cost, no second identity source to reconcile with `User`.

- **Core** — `src/lib/oauth.ts`: token minting, PKCE, consent signing, grants, and `sessionFromOAuthToken()`.
- **Scopes** — `src/lib/mcp/scopes.ts`. Derived from `MCP_TOOLS`, so a new tool with a new permission widens the advertised scopes on its own.
- **Endpoints** — `/oauth/authorize` (the consent page, a real signed-in browser step) plus `/api/oauth/{authorize,token,register,revoke,grants}`. The two `.well-known` discovery documents are handlers under `/api/oauth/` exposed at their spec-mandated paths by `rewrites` in `next.config.ts`.
- **Models** — `OAuthClient`, `OAuthGrant` (one row per user+client connection, rotated in place), `OAuthAuthCode` (single-use, TTL-swept).

**Scopes are hub permission strings.** `logs.create`, not `logs:write`. That makes the effective permission set the same `role ∩ scope ∩ tokenGrantable` chain the personal tokens already compute, and lets an `insufficient_scope` challenge name exactly what the tool's own refusal names. No mapping table to keep in sync.

**Lead permissions are delegable too.** A lead-eligible scope may be handed to a connection on the strength of leading a client, not only by holding the permission outright — otherwise `clients.edit` could never enter a grant and the lead-eligible tools would work with a personal token and be invisible from a connector. Both the consent page and its decide route ask `mayDelegateScope()` (`src/lib/mcp/scopes.ts`), never `hasPermission()` directly. What makes this safe is that `grantPermissions()` builds the two sets from different sources — the *role* for `permissions`, `LeadSettings` for `leadPermissions` — each intersected with the grant, so a scope delegated this way lands only in `leadPermissions` and the handler's own per-client check stays the binding one. The consent screen groups these separately, because "may edit clients" and "may edit the clients you lead" are not the same thing to approve.

**Opaque tokens, never JWTs.** Access tokens are random and stored only as sha256 hashes. This is what satisfies the spec's hard rule that a server accept only tokens issued for itself — a token from another issuer is simply not in the collection, so there is no signature or audience claim to get subtly wrong. It also means revocation and archiving bite on the very next request, since every call re-reads the grant, the user and the role.

**One scope difference from personal tokens.** An empty scope set on an API token means "inherit the owner's role"; on an OAuth grant it means empty. A personal token was created by its owner as a general-purpose credential, but a grant's scopes are what the user was shown and approved, so widening them would grant access nobody consented to.

**Refusals.** Tool refusals stay JSON-RPC tool results (`isError: true`) — that is what preserves the no-partial-write guarantee. The one exception: an OAuth caller refused over a scope its owner *does* hold gets an HTTP 403 with `WWW-Authenticate: … error="insufficient_scope"`, so the client can run the spec's step-up flow. When neither the role nor the lead settings ever had the permission, re-consenting cannot help, so the readable tool result stands.

**Consent hand-off is signed, not hidden.** The consent form posts one HMAC-signed blob rather than a set of hidden inputs, which stops both tampering and cross-site posting. The decide route still re-validates everything against the DB and the live session — the signature proves the values are the ones we rendered, not that they are still allowed.

**`/api/oauth/` and `/.well-known/` are exempt from the middleware gate** (`auth.config.ts`) because a non-browser client reaches them before any session exists. `/oauth/authorize` is deliberately *not* exempt: it is the one step that must happen signed in, and the existing `callbackUrl` handling returns the user there after Google.

Connections are listed and revoked under Profiel → Integrations, next to the API tokens. Both surfaces require a browser session, so a connector can never mint a token or cut off the thing that revokes it.

## Theming

Colors are CSS custom properties in `globals.css` (`--bg-surface`, `--text-primary`, `--primary`, etc.). Dark mode uses the `.dark` class on `<html>` (set by ThemeToggle, initialized before hydration via inline script to prevent flash). Purple is the primary accent (`--primary`).

**Tailwind v4 dark mode** is configured with `@custom-variant dark (&:where(.dark, .dark *))` — use `dark:` utilities freely.

All button variants are `@layer components` in `globals.css`. Use them before creating new button styles:

| Class | Use |
|---|---|
| `btn-primary` | Primary action |
| `btn-secondary` | Secondary action — filled `--primary-light` brand tint, no border (the quiet sibling of `btn-primary`). `btn-primary-light` is a deprecated alias. |
| `btn-border` | Outlined low-emphasis action — transparent + hairline (requires the `border` utility on the element). Was previously called `btn-secondary`. |
| `btn-danger` | Destructive action |
| `btn-ghost` | Subtle / cancel |
| `btn-tertiary` | Inline low-emphasis (e.g. "+ New task") |
| `btn-link` | Text link style |
| `btn-icon` | Icon-only button — shows `--primary-light` bg + `--primary` color on hover |
| `btn-action` | Large column-oriented action tile |

The `/admin/stylesheet` page renders all button variants and every task row state using the real shared components. Check it when making visual changes.

### Design tokens

All visual tokens are CSS custom properties in `globals.css` (`:root` for light, `.dark` for dark mode). The `@theme` block maps these to Tailwind utility classes. This is the single source of truth — never hardcode hex colors in components.

**Token categories** (naming: `--{category}-{variant}`):

| Category | Examples | Purpose |
|---|---|---|
| Core | `--primary`, `--bg-surface`, `--text-muted`, `--border` | Base theme colors |
| Feedback | `--danger`, `--success`, `--warning`, `--info` (+ `-light`) | Semantic state colors |
| Status | `--status-active-bg`, `--status-active-color`, etc. | Badge background/text pairs |
| Accent | `--accent-0` through `--accent-7` | Avatar/client color palette |
| Card types | `--card-deadline`, `--card-deadline-bg`, etc. | Week calendar card colors |
| Activity | `--activity-delete-bg`, `--activity-delete-color`, etc. | Activity log badge colors |
| Leave | `--leave-sick`, `--leave-personal` (+ `-bg`) | Leave type colors |

**Page canvas:** `--bg-tinted` is the **default background for main-section page canvases** (My Day, the dashboard, the clients list, client detail) — the tinted surface that sits *behind* `--bg-surface` cards/panels to give depth. The app shell's `<main>` is `--bg-surface` (white), so a page that wants the canvas look must set `--bg-tinted` on its own scroll container. Never use `--bg-surface` as a page background (it's a card fill) or `--bg-app` (darker; reserved for the outer app frame).

**Interaction fills:** `--bg-hover` and `--bg-selected` both alias `--primary-light` — hover and selected states are a violet brand tint **platform-wide** (rows, nav, lists). For a *static* neutral fill that should NOT read as interactive (status badges, skeletons, disabled/locked surfaces, segmented-control tracks, neutral avatars), use `--bg-neutral` instead.

**Elevation:** a 7-step `--elevation-0…6` ramp (violet-tinted ambient on light, near-black on dark) is the source of truth for shadows; the semantic `--shadow-subtle/card/dropdown/sheet` names alias into it.

**Tailwind utilities** from `@theme` (use these in class names):
- Surfaces: `bg-surface`, `bg-elevated`, `bg-app`, `bg-hover` (brand tint), `bg-sidebar`
- Borders: `border-border-default`, `border-border-strong`
- Text: `text-text-primary`, `text-text-muted`
- Brand: `bg-brand`, `text-brand`, `bg-brand-light`
- Feedback: `bg-danger`, `text-danger`, `bg-success`, `text-success`, `bg-warning`, `text-warning`, `bg-info`, `text-info` (+ `-light` variants)
- Radii: `rounded-card`, `rounded-button`, `rounded-badge`
- Shadows: `shadow-card`, `shadow-subtle`, `shadow-dropdown`, `shadow-sticky`

**Typography composites** (`@layer components`) — use these instead of ad-hoc Tailwind class combinations:

| Class | Equivalent | Use |
|---|---|---|
| `typo-display` | `text-[28px] font-bold` | Hero / greeting moment (rare; My Day) |
| `typo-page-title` | `text-[22px] font-bold` | Page-level h1 headings |
| `typo-modal-title` | `text-lg font-bold` | Modal / right-panel headings |
| `typo-section-title` | `text-sm font-semibold uppercase tracking-wide` | Small group label inside a page (kept uppercase) |
| `typo-card-title` | `text-sm font-semibold` | Card / item titles |
| `typo-section-header` | `text-xs font-semibold uppercase tracking-wider` | Uppercase section headers, table headers |
| `typo-tag` | `10px font-bold uppercase tracking-widest` | Small uppercase tags / badge labels |
| `typo-body` | `text-sm` | Default paragraph / table-cell body |
| `typo-body-sm` | `text-[13px]` | Secondary body (sub-rows, descriptions) |
| `typo-caption` | `text-xs` + muted color | Metadata, dates, helper text |
| `typo-metric` | `text-[32px] font-semibold tabular-nums` | Large numeric metric displays |
| `typo-label` | `block text-[13px] font-semibold mb-1.5` + primary ink | Form field labels (includes display, margin, color) |

**Runtime style utilities** (`src/lib/styles.ts`):
- `ACCENT_COLORS` — accent palette as CSS var array (replaces duplicated hex arrays)
- `accentColor(name)` — hash a string to a stable accent color
- `STATUS_STYLES` — status slug → `{ bg, color }` CSS var pairs

**Class name utility** (`src/lib/cn.ts`): `cn()` wraps `clsx` for conditional class composition.

**Rules for new code:**
- Use CSS custom properties or `@theme` utility classes for all colors, radii, and shadows
- Use values from `src/lib/styles.ts` for runtime JS color needs
- Never add hardcoded hex values in components
- If a new token is needed, add it to `globals.css` `:root` + `.dark` first

## Release Notes

`src/data/release-notes.json` contains user-facing release notes displayed on the Settings page. Before every meaningful commit (new features, bug fixes, visible changes), add an entry to the **top** of the array:

```json
{
  "date": "YYYY-MM-DD",
  "title": "Short description of the change",
  "details": ["Optional bullet point", "Another detail"]
}
```

- `date` must be `YYYY-MM-DD` format
- `title` is required; keep it to one short sentence
- `details` is optional; omit for trivial changes
- Entries must be in reverse chronological order (newest first)
- Do not add release notes for internal refactors, dependency bumps, or changes invisible to users

### Major releases — `whatsNew` popup

For headline releases, optionally add a `whatsNew` block to the entry:

```json
"whatsNew": {
  "id": "stable-feature-id",
  "title": "Optional friendlier title shown in popup + modal (falls back to the release title)",
  "steps": [
    { "title": "Step 1 title", "description": "..." },
    { "title": "Step 2 title", "description": "..." },
    { "title": "Step 3 title", "description": "..." }
  ]
}
```

This triggers a "What's new in SUMM Hub" popup (bottom-right) on app load with a "Toon meer" stepper modal. The `id` is used as the per-user seen-key on `User.seenWhatsNewIds` — pick a stable string and never reuse it. The same release also gets a "Meer info" button on `/settings` so users can replay it anytime.
