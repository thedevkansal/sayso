import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "Asia/Kolkata";

export function tzAbbr(tz: string, at: Date = new Date()): string {
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IST";
  return formatInTimeZone(at, tz, "zzz");
}

/** Wall-clock date + time in `tz` to a UTC ISO string. */
export function zonedToISO(date: string, time: string, tz: string): string {
  return fromZonedTime(`${date}T${time}:00`, tz).toISOString();
}

export function isValidLocalDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
}

export function isValidLocalTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** "Fri 30 Oct, 5:00–5:30 pm IST" */
export function formatRange(startISO: string, endISO: string, tz: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const day = formatInTimeZone(s, tz, "EEE d MMM");
  const sameMeridiem = formatInTimeZone(s, tz, "a") === formatInTimeZone(e, tz, "a");
  const start = formatInTimeZone(s, tz, sameMeridiem ? "h:mm" : "h:mm a").toLowerCase();
  const end = formatInTimeZone(e, tz, "h:mm a").toLowerCase();
  return `${day}, ${start}–${end} ${tzAbbr(tz, s)}`;
}

export function formatDay(date: string, tz: string) {
  return formatInTimeZone(fromZonedTime(`${date}T12:00:00`, tz), tz, "EEE d MMM yyyy");
}

export function formatTime(iso: string, tz: string) {
  return formatInTimeZone(new Date(iso), tz, "h:mm a").toLowerCase();
}

/** A lookup table the model can use instead of doing weekday arithmetic. */
export function dayTable(now: Date, tz: string, days = 21): string {
  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(now, i);
    const label = i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : "";
    lines.push(`${formatInTimeZone(d, tz, "EEEE yyyy-MM-dd")}${label}`);
  }
  return lines.join("\n");
}

export function localDate(now: Date, tz: string) {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** Relative "2h ago" / "Yesterday" / "Mon" for inbox rows. */
export function inboxTime(iso: string, now: Date, tz: string) {
  const d = new Date(iso);
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  if (localDate(d, tz) === localDate(now, tz)) return formatInTimeZone(d, tz, "h:mm a").toLowerCase();
  if (mins < 60 * 24 * 6) return formatInTimeZone(d, tz, "EEE");
  return formatInTimeZone(d, tz, "d MMM");
}
