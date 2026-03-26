# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
```

There is no test suite configured yet.

## Stack

- **Next.js 15** (App Router, `src/` directory, `@/*` alias)
- **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)
- **Lucide React** for icons

## Architecture

```
src/
  app/                      # Next.js App Router pages
    layout.tsx              # Root layout — three-column shell, passes clients to PanelNav
    globals.css             # CSS custom properties for theming (light/dark), hover-row utility class
    dashboard/              # Overview stats + recent clients
    clients/                # Client list table
    clients/[id]/           # Client detail with tab bar (Overview, Projects, Files, Notes)
    clients/[id]/{projects,files,notes}/  # Redirect shims → ?tab=<name>
  components/
    layout/
      IconNav.tsx           # Narrow icon sidebar (far left, "use client" for usePathname)
      PanelNav.tsx          # Second panel — workspace nav + expandable client list ("use client")
      ThemeToggle.tsx       # Dark/light mode toggle — sets .dark on <html>, persists to localStorage
    ui/
      StatusBadge.tsx       # Reusable status pill
  lib/data.ts               # Data access layer (currently in-memory mock data)
  types/index.ts            # Shared TypeScript types (Client, Project, DashboardStats)
```

## UI Layout

Three-column layout:
1. **IconNav** (`w-14`) — icon-only top-level navigation
2. **PanelNav** (`w-56`) — contextual second panel showing workspace nav + client tree
3. **Main** (`flex-1`) — page content, scrollable

## Theming

Colors are driven by CSS custom properties in `globals.css` (`--bg-surface`, `--text-primary`, `--primary`, etc.). Dark mode uses the `.dark` class on `<html>` (set by ThemeToggle, initialized before hydration via inline script in `layout.tsx` to prevent flash). Purple is the primary accent (`--primary`).

**Tailwind v4 dark mode** is configured with `@custom-variant dark (&:where(.dark, .dark *))` — use `dark:` utilities freely.

## Data layer

`src/lib/data.ts` holds mock data and helpers (`getClientById`, `getDashboardStats`). All pages import from here only — swapping to a real DB means only touching this file.

**Routing:** `/` redirects to `/dashboard`. All pages are server components except `IconNav`, `PanelNav`, and `ThemeToggle` (`"use client"`). Do not add event handlers (onMouseEnter etc.) to server components — use the `.hover-row` CSS class from `globals.css` instead.
