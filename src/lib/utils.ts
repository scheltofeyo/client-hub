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

// ── Week calendar utilities ──────────────────────────────────────────────────

export type WeekCardType = "deadline" | "delivery" | "kickoff" | "followup" | "event";

export interface WeekCalendarItem {
  id: string;
  type: WeekCardType;
  date: string;           // YYYY-MM-DD — determines which column it appears in
  title: string;
  clientId: string;
  clientName: string;
  leads: { userId: string; name: string; image?: string }[];
  linkHref: string;
  meta?: string;          // secondary text (e.g. project name for tasks)
}

/**
 * Format a Date as YYYY-MM-DD in a given IANA timezone.
 * All date computations in this app use CET/Amsterdam timezone for consistency.
 */
const TZ = "Europe/Amsterdam";

function tzDateStr(d: Date): string {
  // Use Intl to get the date parts in the target timezone
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA gives YYYY-MM-DD format
}

function tzDay(d: Date): number {
  // Get day-of-week in the target timezone (0=Sun, 1=Mon, ...)
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[dayName] ?? 0;
}

function tzMonth(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" }).format(d);
}

function tzDateNum(d: Date): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" }).format(d), 10);
}

function tzYear(d: Date): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(d), 10);
}

/**
 * Returns the Mon–Fri date range for a given week offset.
 * weekOffset=0 → current week, 1 → next week, -1 → last week.
 * Uses Europe/Amsterdam timezone for all date calculations.
 */
export function getWeekRange(weekOffset: number = 0): { start: string; end: string; label: string } {
  const now = new Date();
  // Find Monday of the current week in target timezone
  const day = tzDay(now); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getTime() + (diffToMonday + weekOffset * 7) * 86400000);
  const friday = new Date(monday.getTime() + 4 * 86400000);

  const start = tzDateStr(monday);
  const end = tzDateStr(friday);

  // Format label: "Apr 6 – 10, 2026" or "Mar 31 – Apr 4, 2026" if cross-month
  const startMonth = tzMonth(monday);
  const endMonth = tzMonth(friday);
  const year = tzYear(friday);
  const label = startMonth === endMonth
    ? `${startMonth} ${tzDateNum(monday)} – ${tzDateNum(friday)}, ${year}`
    : `${startMonth} ${tzDateNum(monday)} – ${endMonth} ${tzDateNum(friday)}, ${year}`;

  return { start, end, label };
}

export interface DayColumn {
  date: string;
  label: string;     // e.g. "Apr 8"
  dayName: string;   // e.g. "Mon"
  isToday: boolean;
}

/** Returns 5 day column descriptors for Mon–Fri of the given range. */
export function getDayColumns(start: string, end: string): DayColumn[] {
  const today = tzDateStr(new Date());
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const columns: DayColumn[] = [];
  // Parse the start date string and increment by day using ms arithmetic
  const [sy, sm, sd] = start.split("-").map(Number);
  // Create a date at noon UTC to avoid DST edge cases when adding days
  const base = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));

  for (let i = 0; i < 5; i++) {
    const cur = new Date(base.getTime() + i * 86400000);
    const dateStr = tzDateStr(cur);
    if (dateStr > end) break;
    columns.push({
      date: dateStr,
      label: `${tzMonth(cur)} ${tzDateNum(cur)}`,
      dayName: dayNames[i],
      isToday: dateStr === today,
    });
  }
  return columns;
}

/** Map a weekend date (Sat/Sun) to the preceding Friday. */
export function mapToWeekday(dateStr: string, weekEnd: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = tzDay(date);
  if (day === 6) { // Saturday → Friday
    return tzDateStr(new Date(date.getTime() - 86400000));
  }
  if (day === 0) { // Sunday → Friday
    return tzDateStr(new Date(date.getTime() - 2 * 86400000));
  }
  return dateStr;
}

/** Week card type display config. Colors reference CSS custom properties (auto dark mode). */
export const WEEK_CARD_TYPES: Record<WeekCardType, { label: string; color: string; bg: string }> = {
  deadline:  { label: "Deadline",  color: "var(--card-deadline)",  bg: "var(--card-deadline-bg)" },
  delivery:  { label: "Delivery",  color: "var(--card-delivery)",  bg: "var(--card-delivery-bg)" },
  kickoff:   { label: "Kick-off",  color: "var(--card-kickoff)",   bg: "var(--card-kickoff-bg)" },
  followup:  { label: "Follow-up", color: "var(--card-followup)",  bg: "var(--card-followup-bg)" },
  event:     { label: "Event",     color: "var(--card-event)",     bg: "var(--card-event-bg)" },
};

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
