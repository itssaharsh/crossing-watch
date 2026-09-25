/** Juja is on EAT (UTC+3) all year; no DST, so plain arithmetic is exact. */
export const EAT_OFFSET_MS = 3 * 3600_000;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Swahili has no standard short weekday forms: use full names
const DAYS_SW = ["Jumapili", "Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

export function eat(t: number) {
  const d = new Date(t + EAT_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth(),
    d: d.getUTCDate(),
    wd: d.getUTCDay(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
  };
}

/** "17:15" */
export function hhmm(t: number): string {
  const e = eat(t);
  return `${pad(e.h)}:${pad(e.mi)}`;
}

/** "Wed 18 Mar" */
export function dayLabel(t: number, lang: "en" | "sw" = "en"): string {
  const e = eat(t);
  return `${(lang === "sw" ? DAYS_SW : DAYS)[e.wd]} ${e.d} ${MONTHS[e.mo]}`;
}

/** "18 Mar" */
export function shortDate(t: number): string {
  const e = eat(t);
  return `${e.d} ${MONTHS[e.mo]}`;
}

/** Parse "2026-03-18T17:00" as EAT local time. */
export function parseEat(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - EAT_OFFSET_MS;
}

/** Round a time to the nearest 5 minutes (for "clears ~19:40"). */
export function round5(t: number): number {
  const five = 5 * 60_000;
  return Math.round(t / five) * five;
}
