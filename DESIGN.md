# Design

Captured from `src/app/globals.css` (the single source of truth). Tokens are CSS custom properties on `:root` (light) and `.dark`; `@theme` maps them to Tailwind utilities. Never hardcode hex in components.

## Theme

Violet-forward, light-first. Deep indigo ink on a faintly violet-tinted canvas; a single violet accent (`--primary`). Dark mode exists app-wide but the **public proposal surface is light-only**. Public artifacts re-theme around each **client's brand color** (`Client.primaryColor`), falling back to `--primary`.

## Color

| Role | Token | Light |
|---|---|---|
| App canvas | `--bg-app` | `#f2f1f9` |
| Surface (cards) | `--bg-surface` | `#ffffff` |
| Elevated / tinted | `--bg-elevated` | `#f8f7fc` |
| Page canvas (main) | `--bg-tinted` | `#fbfaff` |
| Neutral fill | `--bg-neutral` | `#e8e6f3` |
| Hover / selected | `--bg-hover` / `--bg-selected` | `= --primary-light` (brand tint) |
| Border | `--border` / `--border-strong` | `#e0deef` / `#c0bcd6` |
| Ink | `--text-primary` | `#1a1830` (deep indigo) |
| Muted | `--text-muted` | `#8b88ad` ⚠️ |
| Primary | `--primary` / `--primary-light` | `#7c3aed` / `#ede9fe` |
| Feedback | `--danger` `--success` `--warning` `--info` (+ `-light`) | red/green/amber/blue |
| Accent palette | `--accent-0…7` | avatar / client colors |

⚠️ **`--text-muted` (`#8b88ad`) is ~3:1 on white** — fails AA for small text. Proposal surface introduces a darker proposal-scoped ink for labels/lead (see Motion/Proposal tokens).

**Elevation:** 7-step `--elevation-0…6` ramp (violet-tinted ambient on light). Semantic aliases: `--shadow-subtle` (=2), `--shadow-card` (=3), `--shadow-dropdown` (=4), `--shadow-sheet` (=5).

**Radii:** `--radius-card` `0.75rem`, `--radius-button`/`--radius-input` `0.5rem`, `--radius-badge` `9999px`.

## Typography

- **Family:** Ubuntu Sans (`--font-ubuntu-sans`, via `next/font`), system fallback. Single family, weight/scale contrast for hierarchy. Base 14px.
- **App scale** (`@layer components`): `typo-page-title`, `typo-section-title`, `typo-card-title`, `typo-section-header`, `typo-metric`, `typo-label`, `typo-body`, etc.
- **Proposal scale** (editorial, separate): `typo-proposal-h1` `clamp(3rem,1.5rem+4vw,4.5rem)`, `-h2`/`-h2-large`/`-h3`, `-lead`, `-eyebrow` (11px upper, 0.22em), `-inline-label` (10px upper, 0.18em). Headlines are **solid color** (no gradient text). Use `text-wrap: balance` on headings.

## Components (shared, reuse before building)

- Buttons (`@layer components`): `btn-primary`, `btn-secondary` (filled tint), `btn-border` (outlined), `btn-danger`, `btn-ghost`, `btn-tertiary`, `btn-link`, `btn-icon`, `btn-action`. Reference: `/admin/stylesheet`.
- `UserAvatar`, `RichTextDisplay`, `PageHeader`, task-row primitives.
- Runtime style helpers: `src/lib/styles.ts` (`ACCENT_COLORS`, `accentColor()`, `STATUS_STYLES`, `readableFg()`), `src/lib/cn.ts`.

## Layout

- App: three-column shell (IconNav 56px · PanelNav 224px · Main). Right slide-in panel via `RightPanel` context.
- Public proposal: single centered column, `max-w-3xl` (~768px) reading measure, fluid `clamp()` section padding; full-bleed hero + accent bands.

## Motion

- **Curves:** ease-out-quint `cubic-bezier(0.22, 1, 0.36, 1)` is the house curve (see `survey-step-in`). No bounce/elastic except the established success check-pop overshoot.
- **Existing vocabulary** (`globals.css`): `@keyframes survey-step-in` (320ms), `survey-confetti-drift` (900ms), `survey-check-pop` (500ms) + `.survey-step-in`, all behind a `@media (prefers-reduced-motion: reduce)` guard. Reuse for celebration moments.
- **Proposal additions:** brand-mesh blob drift (long, transform-only, paused off-screen), `.proposal-reveal`/`.is-visible` (fade + 12px rise, IO-driven, visible-by-default), timeline bar grow-in (`scaleX`, staggered via `--i`), grid-rows `0fr→1fr` expand, rAF count-up for the investment total. All transform/opacity; expensive layers (mesh/parallax/glass) shed on mobile + reduced-motion.
- **Proposal-scoped tokens:** a darker muted ink for AA-compliant labels/lead on light surfaces.
