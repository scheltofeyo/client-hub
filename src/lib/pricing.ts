/**
 * Discount math shared by the plan editor, public proposal API, PDF render
 * and finance analytics. Pure and dependency-free so it can be imported from
 * client components, API routes and server data helpers alike.
 *
 * `soldPrice` is always stored gross in the DB; net prices are derived at
 * read time via these helpers.
 */

export type DiscountType = "percentage" | "amount";

/** Euro discount for a gross price. Clamped to [0, gross] so net never goes negative. */
export function discountAmountFor(
  gross: number,
  discountType?: DiscountType | null,
  discountValue?: number | null
): number {
  if (!discountType || discountValue == null || discountValue <= 0) return 0;
  const raw = discountType === "percentage" ? gross * (discountValue / 100) : discountValue;
  return Math.min(Math.max(0, raw), Math.max(0, gross));
}

/** Gross price minus the (clamped) discount. */
export function netPriceFor(
  gross: number,
  discountType?: DiscountType | null,
  discountValue?: number | null
): number {
  return Math.max(0, gross - discountAmountFor(gross, discountType, discountValue));
}
