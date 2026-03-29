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

## Architecture

### App structure

```
src/
  app/
    layout.tsx                  # Root HTML shell — dark mode init script, metadata
    (app)/layout.tsx            # Protected group — SessionProvider, three-column shell
    (app)/dashboard/            # Stats overview
    (app)/clients/              # Client list table
    (app)/clients/[id]/         # Client detail — tabs: Dashboard, Projects, Tasks, Sheets, Logbook, Events, Activity, Settings
    (app)/admin/                # Admin panel — users, archetypes, services, signals, templates, reference data
    (app)/admin/templates/      # Project template editor with TemplateTask management
    (app)/admin/stylesheet/     # Visual reference page — renders all button variants and task row states using real components
    (app)/projects/             # Cross-client project list
    (app)/tasks/                # Cross-client task list
    api/                        # Route handlers (see API layer below)
  components/
    layout/                     # Shell components (nav, panels, header)
    ui/                         # Feature components (tabs, forms, shared primitives)
  lib/
    mongodb.ts                  # Global Mongoose connection (singleton, dev-safe)
    data.ts                     # Server-side data helpers with React cache() deduplication
    activity.ts                 # recordActivity() — non-critical audit trail helper
    utils.ts                    # Shared helpers: fmtDate, daysAgo, timeAgoLabel
    models/                     # Mongoose models (see Data Models below)
  types/index.ts                # All shared TypeScript interfaces
  auth.ts / auth.config.ts      # NextAuth callbacks + edge-safe config
```

### UI layout

Three-column layout within `(app)/layout.tsx`:
1. **IconNav** (`w-14`) — icon-only sidebar, far left
2. **PanelNav** (`w-56`) — contextual second panel. Becomes **ClientPanelNav** on client pages, **AdminPanelNav** on admin pages
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
| `User` | googleId, name, email, image, isAdmin — synced from Google on every login |
| `Client` | company, status, platform, contacts[], leads[], archetypeId |
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
/api/users                          GET, POST
/api/users/[id]                     GET, PATCH
/api/users/assignable               GET — users eligible for task assignment
```

All routes call `auth()` and return 401/403 as appropriate. Admin-only actions check `session.user.isAdmin`.

## Key Patterns

### User images
`User.image` (Google profile photo URL) is the single source of truth, refreshed on every login. APIs that return user-linked data do a **batch lookup** of current `User.image` by userId at read time — never use stale snapshots. The shared `UserAvatar` component (`src/components/ui/UserAvatar.tsx`) is used everywhere. Props: `name`, `image`, `size` (px, default 24).

### Activity recording
`recordActivity()` in `src/lib/activity.ts` is fire-and-forget (errors are swallowed). Call it after any meaningful mutation.

### React cache() deduplication
`src/lib/data.ts` wraps DB queries in React `cache()` — a single server render that calls `getClientById()` from both the layout and the page component only hits the DB once.

### Task completion → project status
When tasks are completed or deleted, the tasks API recalculates and updates the parent project's status automatically (`not_started` / `in_progress` / `completed`).

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
