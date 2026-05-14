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
 * Hatched / striped fill pattern id, used to indicate low-confidence data.
 * Define the matching <pattern> in the chart's <defs> via the
 * `LowConfidencePatternDef` component.
 */
export const LOW_CONFIDENCE_PATTERN_ID = "chart-lowconf-hatch";
