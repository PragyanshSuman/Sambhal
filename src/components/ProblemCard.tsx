"use client";

import Link from "next/link";
import { CheckCircle2, Clock, MapPin, Users } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { timeAgo } from "@/lib/format";
import type { ProblemCard as Card } from "@/lib/types";
import { CategoryLabel, PathBadge, SeverityBadge, StatusBadge } from "./Badges";

export function ProblemCard({ problem }: { problem: Card }) {
  const { locale } = useI18n();
  const photo = problem.photos[0];
  return (
    <Link
      href={`/problems/${problem.id}`}
      className="glass-panel group relative flex flex-col overflow-hidden bg-surface/40 p-1 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5 dark:bg-surface/20"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10 flex flex-1 flex-col rounded-2xl bg-surface/60 p-4 backdrop-blur-sm dark:bg-surface/40">
        <div className="mb-4 flex items-start gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-line/50 bg-surface-2 shadow-inner">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- user photos from Supabase Storage
              <img src={photo} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-surface-2 to-line/20">
                <MapPin className="size-6 text-ink-soft/30" />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap gap-1">
              <StatusBadge status={problem.status} />
              <PathBadge path={problem.path} />
            </div>
            <SeverityBadge severity={problem.severity} />
          </div>
        </div>

        <h3 className="mb-2 line-clamp-2 text-lg leading-tight font-bold tracking-tight text-ink transition-colors group-hover:text-brand">
          {problem.title}
        </h3>
        {problem.locality && <p className="mb-1 truncate text-xs text-ink-soft">{problem.locality}</p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-y-2 border-t border-line/30 pt-4 text-xs font-medium text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span className="max-w-[120px] truncate">
              <CategoryLabel category={problem.category} />
            </span>
            <span className="size-1 rounded-full bg-line" />
            <span className="flex items-center gap-1" suppressHydrationWarning>
              <Clock className="size-3" /> {timeAgo(problem.created_at, locale)}
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-line/20 bg-surface-2/50 px-2.5 py-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-brand" /> {problem.confirm_count}
            </span>
            <span className="size-1 rounded-full bg-line" />
            <span className="flex items-center gap-1">
              <Users className="size-3.5 text-accent" /> {problem.support_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
