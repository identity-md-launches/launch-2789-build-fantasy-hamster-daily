export const DAY_MS = 86_400_000;
export const WATCH_MS = DAY_MS / 4;
export const WATCHES = ["Dawn", "Morning", "Afternoon", "Night"] as const;
export const dayKey = (time: number | Date = Date.now()): string =>
  new Date(time).toISOString().slice(0, 10);
export const dayStart = (day: string): number =>
  Date.parse(`${day}T00:00:00.000Z`);
export const validDay = (day: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(dayStart(day)) &&
  dayKey(dayStart(day)) === day;
export const addDays = (day: string, count: number): string =>
  dayKey(dayStart(day) + count * DAY_MS);
// A stable game number, independent of the visitor's first visit and local timezone.
export const dayNumber = (day: string): number =>
  Math.floor((dayStart(day) - dayStart("2026-01-01")) / DAY_MS) + 1;
export const displayDay = (day: string): string =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dayStart(day)));
export function countdown(until: number, now: number): string {
  const seconds = Math.max(0, Math.floor((until - now) / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
