/** Build a display name from user fields, using fallback chain. */
export function buildDisplayName(user: {
  displayName?: string | null;
  googleName?: string | null;
  firstName?: string | null;
  preposition?: string | null;
  lastName?: string | null;
  email?: string;
}): string {
  if (user.displayName) return user.displayName;
  if (user.googleName) return user.googleName;
  const parts = [user.firstName, user.preposition, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return user.email ?? "Unknown";
}

/** Convert a YYYY-MM-DD string to DD-MM-YYYY for display. Returns the original value if it doesn't match the expected format. */
export function fmtDate(date: string | undefined | null): string {
  if (!date) return "—";
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return date;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Number of full days between a YYYY-MM-DD date and today (positive = in the past). */
export function daysAgo(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
}

/** Human-readable relative label for a number of days (e.g. "3 weeks ago"). */
export function timeAgoLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
