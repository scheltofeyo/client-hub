/** Convert a YYYY-MM-DD string to DD-MM-YYYY for display. Returns the original value if it doesn't match the expected format. */
export function fmtDate(date: string | undefined | null): string {
  if (!date) return "—";
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return date;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
