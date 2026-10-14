"use client";

import { ArrowRightLeft, CalendarHeart, EyeOff, Flag, Hand, MessageCircle, RotateCcw, Undo2, Wrench } from "lucide-react";
import { FlagButton } from "@/components/FlagButton";
import { ModerationControls } from "@/components/ModerationControls";
import { useI18n } from "@/i18n/client";
import { systemText, timeAgo } from "@/lib/format";
import type { ProblemPath } from "@/lib/taxonomy";
import type { TimelineEntry } from "@/lib/types";

const ICONS = {
  comment: MessageCircle,
  status: Flag,
  claim: Hand,
  release: Undo2,
  resolution: Wrench,
  path_change: ArrowRightLeft,
  reopen: RotateCcw,
  system: CalendarHeart,
} as const;

export function Timeline({
  entries,
  userId,
  moderator,
}: {
  entries: TimelineEntry[];
  userId: string | null;
  moderator: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <ol className="space-y-4">
      {entries.map((e) => {
        const Icon = ICONS[e.kind];
        const who = e.profiles?.display_name ?? (e.user_id ? t.system.aPeer : t.system.sambhal);
        const pathChange = e.kind === "path_change" && e.meta ? (e.meta as { from: ProblemPath; to: ProblemPath }) : null;
        const body = e.kind === "comment" || e.kind === "path_change" ? e.body : systemText(e.body, t);
        return (
          <li key={e.id} className={`flex gap-3 ${e.hidden_at ? "opacity-60" : ""}`}>
            <span
              className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                e.kind === "resolution"
                  ? "bg-brand text-brand-ink"
                  : e.kind === "reopen"
                    ? "bg-danger-soft text-danger"
                    : "bg-surface-2 text-ink-soft"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-semibold">{who}</span>
                <span className="text-ink-soft" suppressHydrationWarning>
                  · {timeAgo(e.created_at, locale)}
                </span>
                {e.hidden_at && (
                  <span className="inline-flex items-center gap-1 text-xs text-danger">
                    <EyeOff className="size-3" /> {t.moderation.hidden}
                  </span>
                )}
              </p>
              {pathChange && (
                <p className="text-sm text-ink-soft">
                  {t.system.changedPath} {t.taxonomy.paths[pathChange.from]?.short} →{" "}
                  <strong className="text-ink">{t.taxonomy.paths[pathChange.to]?.short}</strong>
                </p>
              )}
              {body && <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{body}</p>}
              {e.photo_url && (
                <a href={e.photo_url} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user photo */}
                  <img src={e.photo_url} alt="" className="max-h-56 rounded-xl object-cover" loading="lazy" />
                </a>
              )}
              {e.kind === "comment" && (
                <div className="mt-1">
                  {moderator ? (
                    <ModerationControls type="update" id={e.id} hidden={!!e.hidden_at} />
                  ) : (
                    userId && userId !== e.user_id && <FlagButton type="update" id={e.id} compact />
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
