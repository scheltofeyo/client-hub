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
