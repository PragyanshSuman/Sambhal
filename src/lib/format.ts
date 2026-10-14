import { fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

const rtf = {
  en: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
  hi: new Intl.RelativeTimeFormat("hi", { numeric: "auto" }),
};

export function timeAgo(iso: string, locale: Locale = "en") {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf[locale].format(Math.round(seconds / size), unit);
  }
  return locale === "hi" ? "अभी-अभी" : "just now";
}

export function formatDate(iso: string, locale: Locale, withTime = false) {
  return new Date(iso).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "numeric", minute: "2-digit", weekday: "short" } : {}),
    timeZone: "Asia/Kolkata",
  });
}

/** ISO timestamp `days` ago (UTC). */
export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

/** Hours from now until `iso` (negative if past). */
export function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3600_000;
}

export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function errorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
  return "Something went wrong. Please try again.";
}

// Timeline entries written by the database are in English; show them in the reader's language.
const SYSTEM_PATTERNS: [RegExp, (t: Dictionary, m: RegExpMatchArray) => string][] = [
  [/^Reported$/, (t) => t.system.reported],
  [/^Confirmed by (\d+) neighbours$/, (t, m) => fmt(t.system.confirmedBy, { n: m[1] })],
  [/^Verified fixed by (\d+) neighbours$/, (t, m) => fmt(t.system.verifiedBy, { n: m[1] })],
  [/^Archived: neighbours on the spot could not find this problem$/, (t) => t.system.archivedNotFound],
  [/^Reopened: neighbours say it is not fixed yet$/, (t) => t.system.reopenedNotFixed],
  [/^No update for (\d+) days, so this is open for a new owner$/, (t, m) => fmt(t.system.staleRelease, { n: m[1] })],
  [/^Released, needs a new owner$/, (t) => t.system.released],
  [/^I'll take this on$/, (t) => t.system.takeThisOn],
  [/^Fixed\. Neighbours, please verify\.$/, (t) => t.system.fixedVerify],
  [/^Planned a cleanup drive$/, (t) => t.system.plannedDrive],
];

export function systemText(body: string, t: Dictionary) {
  for (const [re, render] of SYSTEM_PATTERNS) {
    const m = body.match(re);
    if (m) return render(t, m);
  }
  return body;
}

export function notificationText(body: string, t: Dictionary) {
  for (const [prefix, localized] of Object.entries(t.notificationPrefixes)) {
    if (body.startsWith(prefix)) return localized + body.slice(prefix.length);
  }
  return body;
}
