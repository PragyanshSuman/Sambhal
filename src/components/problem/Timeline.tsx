import { ArrowRightLeft, CheckCircle2, Flag, Hand, MessageCircle, RotateCcw, Undo2, Wrench } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { PATHS, type ProblemPath } from "@/lib/taxonomy";
import type { TimelineEntry } from "@/lib/types";

const ICONS = {
  comment: MessageCircle,
  status: Flag,
  claim: Hand,
  release: Undo2,
  resolution: Wrench,
  path_change: ArrowRightLeft,
  reopen: RotateCcw,
  system: CheckCircle2,
} as const;

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="space-y-4">
      {entries.map((e) => {
        const Icon = ICONS[e.kind];
        const who = e.profiles?.display_name ?? (e.user_id ? "A peer" : "Sambhal");
        const pathChange = e.kind === "path_change" && e.meta ? (e.meta as { from: ProblemPath; to: ProblemPath }) : null;
        return (
          <li key={e.id} className="flex gap-3">
            <span
              className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                e.kind === "resolution" ? "bg-brand text-brand-ink" : e.kind === "reopen" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-soft"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{who}</span>{" "}
                <span className="text-ink-soft">· {timeAgo(e.created_at)}</span>
              </p>
              {pathChange && (
                <p className="text-sm text-ink-soft">
                  Changed path: {PATHS[pathChange.from]?.short} → <strong className="text-ink">{PATHS[pathChange.to]?.short}</strong>
                </p>
              )}
              {e.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{e.body}</p>}
              {e.photo_url && (
                <a href={e.photo_url} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user photo */}
                  <img src={e.photo_url} alt="" className="max-h-56 rounded-xl object-cover" loading="lazy" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
