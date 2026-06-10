import { formatEuro } from "@/lib/proposal-format";

export { formatEuro };

/** Compact euro for axis ticks / dense labels: €0, €5k, €1,2 mln. */
export function formatEuroShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}€${(abs / 1_000_000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} mln`;
  }
  if (abs >= 1_000) {
    return `${sign}€${Math.round(abs / 1000)}k`;
  }
  return `${sign}€${Math.round(abs)}`;
}

/** "2026-Q1" → "Q1 '26" for compact axis labels. */
export function quarterLabel(q: string): string {
  const [year, quarter] = q.split("-");
  return `${quarter} '${year.slice(2)}`;
}
