/**
 * Shared, locale-stable date/time formatting for the whole app (web + focus).
 *
 * Everything here renders the SAME string on every device regardless of the
 * user's OS locale — that consistency is the whole point. We deliberately use
 * plain `Date` methods (no `Intl`, no `toLocaleString`) so output never shifts
 * between machines and the focus app's Hermes runtime needs no Intl polyfill.
 *
 * Mental model for callers:
 *   - Past events (created / updated / commented / last seen …) → formatRelative
 *   - Target / calendar dates (due date, expiry …)             → formatDate
 *   - A span of days                                            → formatDateRange
 * Pair a relative/short label with `formatDateTime(value)` in a `title`/tooltip
 * so the exact moment is always one hover away.
 */

export type DateInput = Date | string | number;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Whole calendar days from `a` to `b` in local time (b after a → positive). */
function calendarDayDiff(a: Date, b: Date): number {
  const am = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bm = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bm - am) / 86_400_000);
}

/** "Wed" — short weekday name. */
export function formatWeekday(value: DateInput): string {
  return WEEKDAYS[toDate(value).getDay()] ?? "";
}

/** "3:45 PM" — 12-hour clock, no seconds. */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  const hour12 = d.getHours() % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Friendly calendar date. Defaults to naming nearby days:
 *   today → "Today", yesterday → "Yesterday", tomorrow → "Tomorrow",
 *   this year → "Jun 11", other year → "Jun 11, 2025".
 * Pass `{ relativeDays: false }` to always get the month/day form.
 */
export function formatDate(
  value: DateInput,
  opts: { relativeDays?: boolean } = {},
): string {
  const { relativeDays = true } = opts;
  const d = toDate(value);
  const now = new Date();

  if (relativeDays) {
    const diff = calendarDayDiff(now, d);
    if (diff === 0) return "Today";
    if (diff === -1) return "Yesterday";
    if (diff === 1) return "Tomorrow";
  }

  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear()
    ? base
    : `${base}, ${d.getFullYear()}`;
}

/** "Today at 3:45 PM" / "Jun 11 at 3:45 PM" / "Jun 11, 2025 at 3:45 PM". */
export function formatDateTime(
  value: DateInput,
  opts: { relativeDays?: boolean } = {},
): string {
  const d = toDate(value);
  return `${formatDate(d, opts)} at ${formatTime(d)}`;
}

/**
 * Compact age of a past event that degrades gracefully:
 *   < 1 min → "just now", < 1 hr → "5m ago", < 1 day → "3h ago",
 *   1 day → "yesterday", < 1 wk → "4d ago", older → "Jun 11" / "Jun 11, 2025".
 * Intended for timestamps in the past; future inputs read as "just now".
 */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);

  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = -calendarDayDiff(now, d);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return formatDate(d, { relativeDays: false });
}

/**
 * Compact day span:
 *   same month → "Jun 4 – 11", different month → "Jun 28 – Jul 2",
 *   different year → "Dec 30, 2025 – Jan 2, 2026".
 */
export function formatDateRange(start: DateInput, end: DateInput): string {
  const s = toDate(start);
  const e = toDate(end);
  const sameMonth =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();

  if (sameMonth) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`;
  }
  return `${formatDate(s, { relativeDays: false })} – ${formatDate(e, {
    relativeDays: false,
  })}`;
}
