/**
 * Single-source-of-truth for chart visual tokens.
 * All values are CSS custom-property references — never hardcode hex.
 *
 * `colorForCategory(name)` produces a deterministic CSS-var color for any
 * categorical key; charts pass these directly into `fill`/`stroke` attributes
 * so dark mode and `--client-accent` overrides flow through automatically.
 */
import { ACCENT_COLORS, accentColor } from "@/lib/styles";

export const CHART_TOKENS = {
  axis: "var(--text-muted)",
  gridline: "var(--border)",
  surface: "var(--bg-surface)",
  textMuted: "var(--text-muted)",
  textPrimary: "var(--text-primary)",
  primary: "var(--primary)",
  primaryLight: "var(--primary-light, var(--primary))",
  onPrimaryStrong: "var(--on-primary-strong)",
  clientAccent: "var(--client-accent, var(--primary))",
  clientAccentLight: "var(--client-accent-light, var(--primary-light, var(--primary)))",
  danger: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
} as const;

export function colorForCategory(key: string): string {
  return accentColor(key);
}

export const CATEGORY_PALETTE = ACCENT_COLORS;

/**
 * `count` sequential tints of one colour, from the colour itself down to a
 * faint wash.
 *
 * Mixed toward `--bg-surface` rather than toward white, so a single call gives
 * a ramp that lightens on the light theme and darkens on the dark one — no
 * second palette, and no hex parsing, which matters because these colours are
 * client-entered on the cultural values and arrive as CSS variables in places
 * like the stylesheet gallery.
 */
export function surfaceTints(color: string, count: number): string[] {
  if (count <= 1) return [color];
  return Array.from({ length: count }, (_, i) => {
    const strength = 100 - Math.round((i / (count - 1)) * 70);
    return strength >= 100
      ? color
      : `color-mix(in oklab, ${color} ${strength}%, ${CHART_TOKENS.surface})`;
  });
}

/**
 * Hatched / striped fill pattern id, used to indicate low-confidence data.
 * Define the matching <pattern> in the chart's <defs> via the
 * `LowConfidencePatternDef` component.
 */
export const LOW_CONFIDENCE_PATTERN_ID = "chart-lowconf-hatch";
