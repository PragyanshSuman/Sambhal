import Link from "next/link";
import { CheckCircle2, Users, MapPin, Clock } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { ProblemCard as Card } from "@/lib/types";
import { PathBadge, SeverityBadge, StatusBadge, categoryLabel } from "./Badges";

export function ProblemCard({ problem }: { problem: Card }) {
  const photo = problem.photos[0];
  return (
    <Link
      href={`/problems/${problem.id}`}
      className="glass-panel group relative flex flex-col overflow-hidden bg-surface/40 p-1 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5 dark:bg-surface/20"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10 flex flex-1 flex-col rounded-2xl bg-surface/60 p-4 backdrop-blur-sm dark:bg-surface/40">
        <div className="mb-4 flex items-start gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2 shadow-inner border border-line/50">
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
        
        <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-tight tracking-tight text-ink group-hover:text-brand transition-colors">
          {problem.title}
        </h3>
        
        <div className="mt-auto pt-4 border-t border-line/30 flex flex-wrap items-center justify-between gap-y-2 text-xs font-medium text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span className="truncate max-w-[120px]">{categoryLabel(problem.category)}</span>
            <span className="size-1 rounded-full bg-line" />
            <span className="flex items-center gap-1"><Clock className="size-3" /> {timeAgo(problem.created_at)}</span>
          </div>
          
          <div className="flex items-center gap-3 bg-surface-2/50 px-2.5 py-1 rounded-full border border-line/20">
            <span className="flex items-center gap-1" title="Confirmations">
              <CheckCircle2 className="size-3.5 text-brand" /> {problem.confirm_count}
            </span>
            <span className="size-1 rounded-full bg-line" />
            <span className="flex items-center gap-1" title="Supporters">
              <Users className="size-3.5 text-accent" /> {problem.support_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
