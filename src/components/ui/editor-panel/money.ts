// Single source of truth for budget/role-allocation money math.
// Used by the plan editor, the template editor, the budget editor and the
// plan sidebar budget card so the same numbers are computed everywhere.

export interface MoneyAllocationLine {
  days: number;
  dayRate: number;
  marginMultiplier: number;
  isExternal?: boolean;
  externalCostRate?: number;
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Gross sell value of one role line: days × day rate × margin. */
export function lineTotal(line: MoneyAllocationLine): number {
  return (line.days || 0) * (line.dayRate || 0) * (line.marginMultiplier || 1);
}

/** What we pay out to an external resource for this line (internal-only metric). */
export function linePayout(line: MoneyAllocationLine): number {
  if (!line.isExternal || line.externalCostRate == null) return 0;
  return (line.days || 0) * line.externalCostRate;
}

export function sumTotals(lines: MoneyAllocationLine[] | null | undefined): number {
  return (lines ?? []).reduce((sum, l) => sum + lineTotal(l), 0);
}

export function sumPayouts(lines: MoneyAllocationLine[] | null | undefined): number {
  return (lines ?? []).reduce((sum, l) => sum + linePayout(l), 0);
}
