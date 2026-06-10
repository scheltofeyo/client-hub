/** Shared formatters for the public proposal surface (web + variant components). */

export function localeFor(lang?: "nl" | "en" | null): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(s: string | null, lang: "nl" | "en" = "nl"): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(lang), { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(s: string | null, lang: "nl" | "en" = "nl"): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(lang), { day: "numeric", month: "short" });
}
