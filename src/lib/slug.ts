/**
 * Convert a free-form string (e.g. company name) into a URL-safe slug.
 *
 * Lowercases, strips diacritics, collapses non-alphanumerics into single
 * dashes, and trims leading/trailing dashes. Used for decorative segments
 * in public share URLs — the canonical lookup is always by shareCode, so
 * mismatched slugs still resolve to the right session.
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "survey";
}
