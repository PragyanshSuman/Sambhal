// Notices, collective asks, appeals and RTI applications, filled from templates in
// the browser. Free, instant, and the same every time.

import { fmt, type Locale } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/dictionaries";
import type { Problem } from "./types";
import { daysSince } from "./format";

export const DRAFT_KINDS = ["owner_notice", "collective_ask", "appeal", "rti"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export function draftText(kind: DraftKind, problem: Problem, link: string, locale: Locale) {
  const where = [problem.address, problem.locality, problem.city].filter(Boolean).join(", ") ||
    `${problem.lat.toFixed(5)}, ${problem.lng.toFixed(5)}`;
  return fmt(dictionaryFor(locale).drafts[kind], {
    title: problem.title,
    where,
    days: daysSince(problem.created_at),
    confirms: problem.confirm_count,
    supports: problem.support_count,
    link,
  });
}
