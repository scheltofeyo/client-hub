# Product

## Register

product

> **Note on register.** SUMM Hub itself is a **product** surface (an internal agency dashboard — efficiency and clarity serve the work). But it hosts a family of **public, client-facing brand surfaces** that are **brand** register, where the design *is* the product: the proposal page (`/proposal/[shareCode]`), the survey/participant flow (`/s/[clientSlug]/[shareCode]`), and value-ranking sessions (`/ranking/[shareCode]`). When working on those public surfaces, treat the task as **brand** (use `reference/brand.md`).

## Users

- **Internal (product surfaces):** SUMM employees — consultants, leads, admins — managing clients, projects, tasks, logbooks, events, templates and tools. They work in the app daily and value speed, density, and low friction.
- **External (brand surfaces):** SUMM's clients and their stakeholders — prospects reading and signing a proposal, workshop participants ranking values, survey respondents. They arrive via a share link, usually once, often on mobile, with no login and no prior context. First impressions carry weight.

## Product Purpose

SUMM is a consultancy that helps organizations with culture, values, and "Cultureel DNA." SUMM Hub is the operational backbone: it runs the client lifecycle internally **and** generates the polished, branded artifacts clients experience directly (proposals, surveys, ranking sessions). Success on the public surfaces = the client feels SUMM is a serious, modern, design-led studio, and completes the intended action (accept the proposal, finish the survey) without confusion.

## Brand Personality

- **Internal app:** calm, clear, efficient, trustworthy. Gets out of the way.
- **Public client-facing surfaces:** **bold, modern, design-forward.** Striking and contemporary; signals a studio that takes craft and culture seriously and isn't afraid to stand out — while staying credible for documents people actually sign. Voice in copy is warm, human, and quietly confident (Dutch first), e.g. "Klaar om te starten?", "we gaan voor je aan de slag".

## Anti-references

- Generic SaaS invoice / quote / e-sign tools (DocuSign-style chrome, stock "professional" gradients).
- Corporate gradient sales decks and template marketplace landing pages.
- The saturated **editorial-typographic AI lane** (display-serif + italic + uppercase mono labels + ruled separators + monochrome restraint + zero imagery). The proposal page currently drifts toward this; move off it.
- Anything that reads as "AI made that": eyebrow kicker above every section, identical card grids, gradient-clipped text, decorative glassmorphism everywhere, side-stripe accent borders.

## Design Principles

1. **The client's brand is the hero.** Each public artifact is themed by the client's own brand color; lean into it rather than burying it under SUMM's violet.
2. **A document people sign, not a billboard.** Be bold in the hero and the choreography; keep the body high-contrast, scannable, and trustworthy.
3. **Motion clarifies, never blocks.** One signature entrance and a few earned moments beat fade-on-every-section. Nothing gates content or delays the task.
4. **Graceful degradation is the design.** Expensive layers (mesh, parallax, glass) shed cleanly on mobile, low power, and reduced-motion — the core reads perfectly without them.
5. **Reuse the system.** Tokens, the `typo-*` scale, and the existing motion vocabulary are the source of truth; new values become tokens, not one-offs.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA**: body/labels ≥ 4.5:1, large text ≥ 3:1, visible keyboard focus, associated form labels, `aria-expanded` on disclosures.
- **Reduced motion is mandatory**: every animation has a `prefers-reduced-motion: reduce` path (instant / crossfade), and content is fully visible without JS.
- Public surfaces are bilingual (NL default, EN); all strings must be language-aware — no hardcoded copy.
