"use client";

import { useMemo } from "react";
import InteractiveLineField, {
  DEFAULT_LINE_COLORS,
  DEFAULT_LINE_PARAMS,
} from "./InteractiveLineField";

/**
 * ProposalHeroLine — full-width interactive line that closes off the proposal
 * hero and acts as the seam into the body. Colour priority:
 *   1. the client's Cultural-DNA colours (if at least two are set)
 *   2. lightness variations of the client's primary brand tint
 *   3. the default SUMM palette
 * The line rests flat and fans into a localized bump under the cursor.
 */

/** Tuned 5-line profile (matches the SUMM palette); generated for any other N. */
const TUNED_5 = [1, 0.6, -0.8, -1.24, 0.16];

function fanProfile(n: number): number[] {
  if (n === 5) return TUNED_5;
  const last = n - 1;
  return Array.from({ length: n }, (_, i) => {
    if (i === last) return 0.16; // backbone (drawn on top) stays near the baseline
    const t = last <= 1 ? 0 : i / (last - 1); // 0..1 across the fanning lines
    return 1.0 + t * (-1.24 - 1.0); // +1.0 (highest) → −1.24 (deepest)
  });
}

/** Five lightness variations of one brand colour — light arcs up, dark dips down. */
function brandTints(b: string): string[] {
  return [
    `color-mix(in srgb, ${b} 55%, white)`, // lightest (highest arc)
    `color-mix(in srgb, ${b} 78%, white)`, // light
    `color-mix(in srgb, ${b} 82%, black)`, // deep (dips down)
    `color-mix(in srgb, ${b} 92%, black)`, // deepest
    b, // pure brand backbone (on top)
  ];
}

function resolveTheme(
  brandColor: string,
  cultureColors: string[]
): { colors: string[]; lineAmps: number[] } {
  const culture = cultureColors.filter(Boolean);
  if (culture.length >= 2) {
    const colors = culture.slice(0, 7);
    return { colors, lineAmps: fanProfile(colors.length) };
  }
  if (brandColor && brandColor !== "var(--primary)") {
    return { colors: brandTints(brandColor), lineAmps: TUNED_5 };
  }
  return { colors: DEFAULT_LINE_COLORS, lineAmps: TUNED_5 };
}

export default function ProposalHeroLine({
  brandColor,
  cultureColors = [],
  className,
}: {
  brandColor: string;
  cultureColors?: string[];
  className?: string;
}) {
  const { colors, lineAmps } = useMemo(
    () => resolveTheme(brandColor, cultureColors),
    [brandColor, cultureColors]
  );
  const params = useMemo(() => ({ ...DEFAULT_LINE_PARAMS, lineAmps }), [lineAmps]);

  return (
    <div className={`w-full ${className ?? ""}`} style={{ background: "var(--bg-app)" }}>
      <InteractiveLineField
        params={params}
        colors={colors}
        className="w-full h-[140px] md:h-[240px]"
      />
    </div>
  );
}
