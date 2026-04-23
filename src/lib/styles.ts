/**
 * Shared runtime style constants and helpers.
 * All values reference CSS custom properties defined in globals.css.
 *
 * This file is the single source of truth for JS-side style values.
 * CSS custom properties remain the ultimate source of truth — this file
 * only re-exports them in formats consumable by React components.
 */

// ── Accent color palette ────────────────────────────────────────────────────
// Used for client/user avatar backgrounds. References CSS custom properties
// so dark mode works automatically via the var() mechanism.

export const ACCENT_COLORS = [
  "var(--accent-0)", "var(--accent-1)", "var(--accent-2)", "var(--accent-3)",
  "var(--accent-4)", "var(--accent-5)", "var(--accent-6)", "var(--accent-7)",
] as const;

/**
 * Hash a string to a stable accent color CSS variable.
 * Use this anywhere you need a deterministic color for a name/id.
 */
export function accentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

// WCAG-ish relative luminance; returns white or near-black for best contrast.
// For non-hex input (like var(--accent-X)) we default to white — the curated
// palette is designed to be readable with white text.
function readableFg(bg: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.4 ? "#0f172a" : "#ffffff";
}

/**
 * Resolve the avatar/badge color pair for a client. If a custom primaryColor
 * is set, use it and pick a contrast-safe foreground; otherwise fall back to
 * the hashed accent color (which is designed for white text).
 */
export function clientColor(client: { company: string; primaryColor?: string }): { bg: string; fg: string } {
  if (client.primaryColor) return { bg: client.primaryColor, fg: readableFg(client.primaryColor) };
  return { bg: accentColor(client.company), fg: "#ffffff" };
}

/** Variant for callsites that only have a name + optional color. */
export function resolveClientColor(name: string, primaryColor?: string): { bg: string; fg: string } {
  return clientColor({ company: name, primaryColor });
}

// ── Status badge styles ─────────────────────────────────────────────────────
// Maps status slugs to CSS variable pairs for background and text color.
// Used by StatusBadge component and status color helpers.

export const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active:       { bg: "var(--status-active-bg)",   color: "var(--status-active-color)" },
  completed:    { bg: "var(--status-active-bg)",   color: "var(--status-active-color)" },
  inactive:     { bg: "var(--status-muted-bg)",    color: "var(--status-muted-color)" },
  not_started:  { bg: "var(--status-muted-bg)",    color: "var(--status-muted-color)" },
  on_hold:      { bg: "var(--status-muted-bg)",    color: "var(--status-muted-color)" },
  prospect:     { bg: "var(--status-accent-bg)",   color: "var(--status-accent-color)" },
  planning:     { bg: "var(--status-planning-bg)", color: "var(--status-planning-color)" },
  in_progress:  { bg: "var(--status-progress-bg)", color: "var(--status-progress-color)" },
  review:       { bg: "var(--status-review-bg)",   color: "var(--status-review-color)" },
};

export const STATUS_STYLE_DEFAULT: { bg: string; color: string } = {
  bg: "var(--status-muted-bg)",
  color: "var(--status-muted-color)",
};
