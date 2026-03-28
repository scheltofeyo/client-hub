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
    (app)/clients/[id]/         # Client detail — tabs: Dashboard, Projects, Sheets, Logbook, Activity, Settings
    (app)/admin/templates/      # Project template editor (new + edit) with TemplateTask management
    (app)/admin/                # Admin panel — users, archetypes, services, signals, templates
    (app)/projects/             # Cross-client project list
    (app)/tasks/                # Cross-client task list
    api/                        # Route handlers (see API layer below)
  components/
    layout/                     # Shell components (nav, panels, header)
    ui/                         # Feature components (LogbookTab, TasksTab, ActivityTab, etc.)
  lib/
    mongodb.ts                  # Global Mongoose connection (singleton, dev-safe)
    data.ts                     # Server-side data helpers with React cache() deduplication
    activity.ts                 # recordActivity() — non-critical audit trail helper
    models/                     # Mongoose models (see Data Models below)
  types/index.ts                # All shared TypeScript interfaces
  types/next-auth.d.ts          # NextAuth Session + JWT augmentation
  auth.ts                       # NextAuth callbacks (signIn, jwt, session)
  auth.config.ts                # Edge-safe auth config (provider setup, authorized callback)
```

### UI layout

Three-column layout within `(app)/layout.tsx`:
1. **IconNav** (`w-14`) — icon-only sidebar, far left
2. **PanelNav** (`w-56`) — contextual second panel (workspace nav + client tree). On client detail pages this becomes **ClientPanelNav**; on admin pages **AdminPanelNav**
3. **Main** (`flex-1`) — scrollable page content

Right-side slide-in panel is managed by **RightPanel** context (`src/components/layout/RightPanel.tsx`) — used for task forms, log forms, etc.

### Client components

Most pages are server components. These are `"use client"`:
- All layout nav components (need `usePathname`, `useSession`)
- All tab/feature UI components (need state, events, fetch)
- `ThemeToggle`, `UserMenu`

Do not add event handlers to server components — use the `.hover-row` CSS class from `globals.css` instead.

## Data Models

All in `src/lib/models/`. Models delete and recompile on hot reload (dev pattern — do not remove the `deleteModel` guards).

| Model | Purpose |
|---|---|
| `User` | googleId, name, email, image, isAdmin — synced from Google on every login |
| `Client` | company, status, platform, contacts[], leads[], archetypeId |
| `Project` | clientId, title, status, completedDate, soldPrice, templateId, serviceId |
| `Task` | projectId, parentTaskId (subtasks), assignees[], completedAt |
| `Log` | clientId, contactIds[], summary, signalIds[], followUp, followUpDeadline |
| `ActivityEvent` | clientId, actorId, actorName, type, metadata — written by `recordActivity()` |
| `Sheet` | clientId, name, url — Google Sheets/docs linked to a client |
| `Archetype` | name, rank — client classification |
| `Service` | name, rank — service offering types |
| `LogSignal` | name, rank — tags on log entries |
| `ProjectTemplate` | name, defaults for new projects |
| `TemplateTask` | templateId, parentTaskId (subtasks), title, assignToClientLead, order — task blueprint attached to a template |

Reference data models (Archetype, Service, LogSignal) support a `rank` field and a `/reorder` POST endpoint for drag-to-reorder in admin UI.

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
/api/clients/[id]/sheets            GET, POST
/api/clients/[id]/sheets/[id]       DELETE
/api/archetypes                     GET, POST + /reorder
/api/services                       GET, POST + /reorder
/api/log-signals                    GET, POST + /reorder
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
`User.image` (Google profile photo URL) is the single source of truth. It is refreshed on every login in the `signIn` callback. The JWT stores `token.image` so `session.user.image` is available server-side. APIs that return user-linked data (activity events, task assignees) do a **batch lookup** of current `User.image` by userId at read time — never use stale snapshots stored on other records.

The shared `UserAvatar` component (`src/components/ui/UserAvatar.tsx`) is used everywhere: activity rows, task assignees, leads section, user menu. Props: `name`, `image`, `size` (px, default 24).

### Activity recording
`recordActivity()` in `src/lib/activity.ts` is fire-and-forget (errors are swallowed). Call it after any meaningful mutation. It stores `actorId` + `actorName` + `type` + `metadata`. The activity GET route joins with UserModel to return current images.

### React cache() deduplication
`src/lib/data.ts` wraps DB queries in React `cache()`. This means a single server render that calls `getClientById()` from both the layout and the page component only hits the DB once.

### Task completion → project status
When tasks are completed or deleted, the tasks API recalculates and updates the parent project's status automatically (`not_started` / `in_progress` / `completed`).

## Theming

Colors are driven by CSS custom properties in `globals.css` (`--bg-surface`, `--text-primary`, `--primary`, etc.). Dark mode uses the `.dark` class on `<html>` (set by ThemeToggle, initialized before hydration via inline script in `layout.tsx` to prevent flash). Purple is the primary accent (`--primary`).

**Tailwind v4 dark mode** is configured with `@custom-variant dark (&:where(.dark, .dark *))` — use `dark:` utilities freely.

Button variants (`btn-primary`, `btn-ghost`, `btn-icon`, `btn-link`) are defined as `@layer components` in `globals.css`. Reuse these before adding new button styles.
