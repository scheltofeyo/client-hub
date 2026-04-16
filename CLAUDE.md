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

All six must also be set in Netlify → Site settings → Environment variables.

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
    (app)/projects/             # Cross-client project list
    api/                        # Route handlers (see API layer below)
  components/
    layout/                     # Shell components (nav, panels, header)
    ui/                         # Feature components (tabs, forms, shared primitives)
    my-day/                     # My Day dashboard components (tasks, follow-ups, projects/Gantt, user card)
    team/                       # Holiday Planner components (HolidayCalendar, BalancesTable)
  lib/
    mongodb.ts                  # Global Mongoose connection (singleton, dev-safe)
    data.ts                     # Server-side data helpers with React cache() deduplication
    activity.ts                 # recordActivity() — non-critical audit trail helper
    utils.ts                    # Shared helpers: fmtDate, daysAgo, timeAgoLabel
    permissions.ts              # Permission registry — all permission strings + groups
    auth-helpers.ts             # hasPermission, hasLeadPermission, requirePermission, contextual checks
    seed-roles.ts               # Ensures system roles exist on first login
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
| `RankingSession` | clientId, title, values[], culturalLevels[], status (`draft`\|`open`\|`closed`\|`archived`), shareCode — workshop value-ranking sessions |
| `RankingSubmission` | sessionId, participantName, rankings[] — participant responses to ranking sessions |

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
```

All routes call `auth()` and return 401/403 as appropriate. Permission checks use `requirePermission(session, "permission.key")` or `hasPermission(session, "permission.key")` from `src/lib/auth-helpers.ts`. Contextual checks (lead-based, creator-based) combine with permissions via `hasPermissionOrIsLead()` / `hasPermissionOrIsCreator()`.

Permissions are loaded into the JWT/session on login from the `Role` model. The permission registry in `src/lib/permissions.ts` defines all valid permission strings. Role changes take effect on next login.

### Lead permissions

The session carries two permission sets: `permissions` (global) and `leadPermissions` (apply only when the user is a lead on the client). `LeadSettings` (singleton model) defines which permissions leads get. API routes use `hasPermissionOrIsLead(session, permission, client.leads)` to combine both checks. `LEAD_ELIGIBLE_PERMISSIONS` in `permissions.ts` defines which permissions can be granted as lead permissions.

### Employee management & invitation flow

Users must be invited (via admin) before they can log in. `POST /api/users` creates a User with `status: "invited"`. On first Google OAuth login, the user auto-activates if their email matches an invited record. Admin can set display name/image overrides, employment details, and role. The profile page (`/profile`) lets users edit their own personal details using the same `EmployeeDetailEditor` component.

**Exception:** `/api/internal/` routes are excluded from the auth middleware (`auth.config.ts`) and are secured by shared secret instead. Do not add `auth()` calls to these routes. The `/ranking/[shareCode]` page is also public (outside the `(app)` group) — participants access it without logging in.

```
/api/internal/folder-callback   POST — called by GAS after Drive folder creation
/api/clients/[id]/folder-status GET — polled by FolderPendingBanner every 4s
```

## Key Patterns

### User images
`User.image` (Google profile photo URL) is the single source of truth, refreshed on every login. APIs that return user-linked data do a **batch lookup** of current `User.image` by userId at read time — never use stale snapshots. The shared `UserAvatar` component (`src/components/ui/UserAvatar.tsx`) is used everywhere. Props: `name`, `image`, `size` (px, default 24).

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

## Theming

Colors are CSS custom properties in `globals.css` (`--bg-surface`, `--text-primary`, `--primary`, etc.). Dark mode uses the `.dark` class on `<html>` (set by ThemeToggle, initialized before hydration via inline script to prevent flash). Purple is the primary accent (`--primary`).

**Tailwind v4 dark mode** is configured with `@custom-variant dark (&:where(.dark, .dark *))` — use `dark:` utilities freely.

All button variants are `@layer components` in `globals.css`. Use them before creating new button styles:

| Class | Use |
|---|---|
| `btn-primary` | Primary action |
| `btn-secondary` | Secondary/outline action (requires `border` class on the element) |
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

**Tailwind utilities** from `@theme` (use these in class names):
- Surfaces: `bg-surface`, `bg-elevated`, `bg-app`, `bg-hover`, `bg-sidebar`
- Borders: `border-border-default`, `border-border-strong`
- Text: `text-text-primary`, `text-text-muted`
- Brand: `bg-brand`, `text-brand`, `bg-brand-light`
- Feedback: `bg-danger`, `text-danger`, `bg-success`, `text-success`, `bg-warning`, `text-warning`, `bg-info`, `text-info` (+ `-light` variants)
- Radii: `rounded-card`, `rounded-button`, `rounded-badge`
- Shadows: `shadow-card`, `shadow-subtle`, `shadow-dropdown`, `shadow-sticky`

**Typography composites** (`@layer components`) — use these instead of ad-hoc Tailwind class combinations:

| Class | Equivalent | Use |
|---|---|---|
| `typo-page-title` | `text-xl font-semibold` | Page-level h1 headings |
| `typo-modal-title` | `text-lg font-semibold` | Modal / large panel headings |
| `typo-section-title` | `text-base font-semibold` | Major section within a page |
| `typo-card-title` | `text-sm font-semibold` | Card / item titles |
| `typo-section-header` | `text-xs font-semibold uppercase tracking-wide` | Uppercase section headers, table headers |
| `typo-tag` | `10px font-semibold uppercase tracking-wide` | Small uppercase tags / badge labels |
| `typo-metric` | `text-2xl font-semibold tabular-nums` | Large numeric metric displays |
| `typo-label` | `block text-xs font-medium mb-1` + muted color | Form field labels (includes display, margin, color) |

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
