/**
 * Colour maths for cultural-value cards.
 *
 * Cultural values carry a client-chosen hex colour, and every surface that shows
 * one — the ranking tool's detail card, the survey's value screens — needs the
 * same three things from it: a lighter and a darker step for the gradient, and a
 * verdict on whether text sitting on it should be white or dark. Kept in one
 * place so two surfaces showing the same value cannot disagree about its
 * contrast.
 */

/** Hex (with or without #) mixed toward black by `factor` (0..1). */
export function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Hex (with or without #) mixed toward white by `factor` (0..1). */
export function lightenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) + (255 - parseInt(h.substring(0, 2), 16)) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) + (255 - parseInt(h.substring(2, 4), 16)) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) + (255 - parseInt(h.substring(4, 6), 16)) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const [rs, gs, bs] = [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(rs) + 0.7152 * toLinear(gs) + 0.0722 * toLinear(bs);
}

export function shouldUseLightText(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

/** True for a usable 6-digit hex. Cultural value colours are free text and may be blank. */
export function isHexColor(value: string | undefined | null): value is string {
  return typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

// ── Ordinal ramps from a cultural value's colour ────────────────────────────
//
// A value-assessment bar and a value-ranking bar both need N ordered steps of
// one cultural value's own colour. Mixing a fixed percentage toward white does
// not work across hues: an orange is already light, so its faint steps vanish
// into the surface long before a violet's do. So the ramp is anchored on
// lightness instead — the endpoints are placed at fixed oklch L, keeping the
// value's hue, and the browser interpolates between them.
//
// The four anchors below were checked against all eight accent colours with the
// palette validator: monotone lightness, adjacent steps ≥ 0.06 apart at five
// steps, and a faint end clearing 2:1 against its own theme's surface.

const L_STRONG_LIGHT = 0.42;
const L_FAINT_LIGHT = 0.76;
const L_STRONG_DARK = 0.82;
const L_FAINT_DARK = 0.44;
/** Tints lose some chroma as they lighten, or the faint end reads as neon. */
const CHROMA_FALLOFF = 0.45;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

interface Oklch {
  L: number;
  C: number;
  h: number;
}

function hexToOklch(hex: string): Oklch {
  const s = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(s.substring(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q;
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToLinearRgb({ L, C, h }: Oklch): [number, number, number] {
  const A = Math.cos(h) * C;
  const B = Math.sin(h) * C;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function oklchToHex(spec: Oklch): string {
  let { C } = spec;
  const inGamut = (rgb: number[]) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);
  let rgb = oklchToLinearRgb(spec);
  // Lightness is what carries the ordering here, so chroma is what gives way
  // when a step falls outside sRGB.
  for (let i = 0; i < 40 && !inGamut(rgb); i += 1) {
    C *= 0.92;
    rgb = oklchToLinearRgb({ ...spec, C });
  }
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

export interface RampAnchors {
  strongLight: string;
  faintLight: string;
  strongDark: string;
  faintDark: string;
}

/**
 * The two endpoints per theme for `color`'s ordinal ramp. Returns null when the
 * colour is not a plain hex — a CSS variable, say — because the lightness of
 * such a value is not knowable here.
 */
export function ordinalRampAnchors(color: string): RampAnchors | null {
  if (!isHexColor(color)) return null;
  const { C, h } = hexToOklch(color.startsWith("#") ? color : `#${color}`);
  const at = (L: number, falloff: number) => oklchToHex({ L, C: C * (1 - falloff), h });
  return {
    strongLight: at(L_STRONG_LIGHT, 0),
    faintLight: at(L_FAINT_LIGHT, CHROMA_FALLOFF),
    strongDark: at(L_STRONG_DARK, CHROMA_FALLOFF),
    faintDark: at(L_FAINT_DARK, 0),
  };
}
