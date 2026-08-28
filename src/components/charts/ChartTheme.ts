/**
 * Single-source-of-truth for chart visual tokens.
 * All values are CSS custom-property references — never hardcode hex.
 *
 * `colorForCategory(name)` produces a deterministic CSS-var color for any
 * categorical key; charts pass these directly into `fill`/`stroke` attributes
 * so dark mode and `--client-accent` overrides flow through automatically.
 */
import { ACCENT_COLORS, accentColor } from "@/lib/styles";
import { ordinalRampAnchors } from "@/lib/colors";

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
 * Inline custom properties that define `color`'s ordinal ramp on a row.
 *
 * Both theme pairs are written out; `globals.css` picks the one belonging to
 * the active theme. That keeps the ramp correct in dark mode without the chart
 * having to know which theme is on — which matters because these render on the
 * server and in the PDF export, where no such check is available.
 *
 * A colour that is not a plain hex (a CSS variable) cannot be measured here, so
 * it falls back to mixing against the theme tokens directly. Less exact, but
 * cultural values store hex, so only fixtures take this path.
 */
export function ordinalRampVars(color: string): Record<string, string> {
  const anchors = ordinalRampAnchors(color);
  if (!anchors) {
    const strong = `color-mix(in oklab, ${color} 62%, ${CHART_TOKENS.textPrimary})`;
    const faint = `color-mix(in oklab, ${color} 55%, ${CHART_TOKENS.surface})`;
    return {
      "--ramp-strong-l": strong,
      "--ramp-faint-l": faint,
      "--ramp-strong-d": faint,
      "--ramp-faint-d": strong,
    };
  }
  return {
    "--ramp-strong-l": anchors.strongLight,
    "--ramp-faint-l": anchors.faintLight,
    "--ramp-strong-d": anchors.strongDark,
    "--ramp-faint-d": anchors.faintDark,
  };
}

/**
 * Step `index` of `count` on the ramp declared by `ordinalRampVars`, 0 being
 * the strongest. Note the endpoints are fixed, so beyond about six steps
 * adjacent pairs sit closer than the ramp guidance likes; position and the 2px
 * gaps between segments carry the ordering there.
 *
 * Each reference falls back to the light-theme value that `ordinalRampVars`
 * always writes inline. Without that fallback a missing `.ramp-scope` rule —
 * a stale stylesheet, a consumer that forgot the class — makes the whole
 * `color-mix` invalid and the bars render as nothing at all. Degrading to the
 * wrong theme's pair is recoverable; a silently empty chart is not.
 */
const STRONG = "var(--ramp-strong, var(--ramp-strong-l))";
const FAINT = "var(--ramp-faint, var(--ramp-faint-l))";

export function ordinalRampStep(index: number, count: number): string {
  if (count <= 1) return STRONG;
  const pct = 100 - Math.round((index / (count - 1)) * 100);
  return `color-mix(in oklab, ${STRONG} ${pct}%, ${FAINT})`;
}

/**
 * Hatched / striped fill pattern id, used to indicate low-confidence data.
 * Define the matching <pattern> in the chart's <defs> via the
 * `LowConfidencePatternDef` component.
 */
export const LOW_CONFIDENCE_PATTERN_ID = "chart-lowconf-hatch";
