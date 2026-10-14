import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { CalendarClock, CheckCircle2, EyeOff, MapPin, UserRound, Users } from "lucide-react";
import { CategoryLabel, PathBadge, SeverityBadge, StatusBadge } from "@/components/Badges";
import { FlagButton } from "@/components/FlagButton";
import { ProblemsMap } from "@/components/map";
import { ModerationControls } from "@/components/ModerationControls";
import { CommentForm } from "@/components/problem/CommentForm";
import { EventsPanel } from "@/components/problem/EventsPanel";
import { PathPanel, type NearbyHelper } from "@/components/problem/PathPanel";
import { ProblemActions } from "@/components/problem/ProblemActions";
import { ShareButtons } from "@/components/problem/ShareButtons";
import { StatusStepper } from "@/components/problem/StatusStepper";
import { Timeline } from "@/components/problem/Timeline";
import { fmt } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { daysSince, formatDate, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RULES } from "@/lib/taxonomy";
import type { DriveEvent, Problem, Profile, TimelineEntry } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared by generateMetadata and the page so a view costs one query, not two.
const getProblem = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.from("problems").select("*").eq("id", id).maybeSingle<Problem>();
  return data;
});

export async function generateMetadata(props: PageProps<"/[lang]/problems/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const t = await getDictionary();
  const problem = await getProblem(id);
  if (!problem) return { title: t.problem.notFoundTitle, robots: { index: false } };
  const description = `${t.taxonomy.categories[problem.category] ?? problem.category}${problem.locality ? `, ${problem.locality}` : ""}. ${t.taxonomy.statuses[problem.status]}. ${t.share.canYouHelp}`;
  return {
    title: problem.title,
    description,
    openGraph: { title: problem.title, description, type: "article" },
    twitter: { card: "summary_large_image", title: problem.title, description },
    robots: problem.hidden_at ? { index: false } : undefined,
  };
}

export default async function ProblemPage(props: PageProps<"/[lang]/problems/[id]">) {
  const { id } = await props.params;
  const t = await getDictionary();
  const locale = await getLocale();
  const { new: isNew } = await props.searchParams;
  const problem = await getProblem(id);
  if (!problem) notFound();

  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = (auth?.claims?.sub as string | undefined) ?? null;

  const [{ data: timeline }, { data: people }, { data: support }, { data: mine }, { data: helpers }, { data: events }, { data: mod }] =
    await Promise.all([
      supabase
        .from("updates")
        .select("id,kind,body,photo_url,meta,created_at,user_id,hidden_at,profiles(display_name)")
        .eq("problem_id", problem.id)
        .order("created_at", { ascending: true })
        .overrideTypes<TimelineEntry[], { merge: false }>(),
      supabase
        .from("profiles")
        .select("id,display_name,area,reputation,banned_at")
        .in("id", [problem.reporter_id, problem.owner_id].filter(Boolean) as string[])
        .overrideTypes<Profile[], { merge: false }>(),
      userId
        ? supabase.from("supports").select("problem_id").eq("problem_id", problem.id).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from("confirmations").select("kind").eq("problem_id", problem.id).eq("user_id", userId)
        : Promise.resolve({ data: [] as { kind: string }[] }),
      problem.path === "skill" || problem.skills_needed.length > 0
        ? supabase.rpc("helpers_for_problem", { p_problem: problem.id }).then((r) => ({ data: r.data as NearbyHelper[] | null }))
        : Promise.resolve({ data: null }),
      supabase
        .from("events")
        .select("id,problem_id,organizer_id,starts_at,meeting_point,checklist,notes,status,rsvp_count,profiles!events_organizer_id_fkey(display_name),event_rsvps(user_id,profiles(display_name))")
        .eq("problem_id", problem.id)
        .order("starts_at", { ascending: false })
        .overrideTypes<DriveEvent[], { merge: false }>(),
      userId ? supabase.from("moderators").select("user_id").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

  const moderator = !!mod;
  const reporter = people?.find((p) => p.id === problem.reporter_id);
  const owner = problem.owner_id ? people?.find((p) => p.id === problem.owner_id) : null;
  const overdue = problem.due_at && problem.status === "claimed" && new Date(problem.due_at) < new Date();
  const fixed = problem.status === "verified" || problem.status === "resolved";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {isNew && (
        <p className="mb-6 rounded-xl bg-brand-soft p-4 text-sm">
          <strong className="text-brand">{t.report.posted}</strong> {fmt(t.report.postedHelp, { n: RULES.confirmThreshold })}
        </p>
      )}
      {problem.hidden_at && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-danger-soft p-4 text-sm text-danger">
          <EyeOff className="size-4 shrink-0" /> {fmt(t.problem.hiddenBanner, { reason: problem.hidden_reason ?? "" })}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <div className="glass-panel relative overflow-hidden border-white/20 bg-gradient-to-br from-surface/80 to-surface-2/40 p-8 md:p-10">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <MapPin className="size-64 text-brand" />
            </div>
            <div className="relative z-10">
              <div className="mb-4 flex flex-wrap gap-2">
                <StatusBadge status={problem.status} />
                <PathBadge path={problem.path} />
                <SeverityBadge severity={problem.severity} />
              </div>
              <h1 className="mb-4 bg-gradient-to-br from-ink to-ink-soft bg-clip-text text-4xl leading-[1.1] font-black tracking-tight text-transparent sm:text-5xl dark:from-white dark:to-white/70">
                {problem.title}
              </h1>
              <p className="inline-flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-line/20 bg-surface/50 px-4 py-2 text-base font-medium text-ink-soft backdrop-blur-sm">
                <span className="text-brand">
                  <CategoryLabel category={problem.category} />
                </span>
                <span>
                  {fmt(t.problem.reportedBy, { name: reporter?.display_name ?? t.problem.aPeer })} {timeAgo(problem.created_at, locale)}
                </span>
                {(problem.address || problem.locality) && (
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <MapPin className="size-4 text-brand" />
                    {problem.address}
                    {problem.address && problem.locality && ", "}
                    {problem.locality &&
                      (problem.locality_slug ? (
                        <Link href={`/areas/${problem.locality_slug}`} className="underline">
                          {problem.locality}
                        </Link>
                      ) : (
                        problem.locality
                      ))}
                  </span>
                )}
              </p>
              <div className="mt-4">
                {moderator ? (
                  <ModerationControls
                    type="problem"
                    id={problem.id}
                    hidden={!!problem.hidden_at}
                    authorId={problem.reporter_id}
                    authorBanned={!!reporter?.banned_at}
                    showDismiss
                  />
                ) : (
                  userId && userId !== problem.reporter_id && <FlagButton type="problem" id={problem.id} />
                )}
              </div>
            </div>
          </div>

          {problem.photos.length > 0 && (
            <div className={`grid gap-3 ${problem.photos.length > 1 ? "grid-cols-2" : ""}`}>
              {problem.photos.map((src, i) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className={`group relative block overflow-hidden rounded-3xl border border-white/10 shadow-xl ${i === 0 && problem.photos.length === 3 ? "col-span-2" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- user photo from Supabase Storage */}
                  <img
                    src={src}
                    alt={fmt(t.problem.photoAlt, { n: i + 1 })}
                    className="max-h-[32rem] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}

          {problem.description && (
            <div className="glass-panel border-white/10 bg-surface/60 p-8">
              <h3 className="mb-4 text-sm font-bold tracking-widest text-ink-soft uppercase">{t.problem.description}</h3>
              <p className="text-lg leading-relaxed font-medium whitespace-pre-wrap">{problem.description}</p>
            </div>
          )}

          <div className="glass-panel border-white/10 bg-gradient-to-b from-surface/60 to-surface-2/40 p-8 shadow-lg">
            <StatusStepper status={problem.status} />
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line/30 pt-8 text-center">
              <Stat icon={<CheckCircle2 className="size-4 text-brand" />} label={t.problem.confirmed} value={problem.confirm_count} tone="text-brand" />
              <Stat icon={<Users className="size-4 text-accent" />} label={t.problem.affected} value={problem.support_count} tone="text-accent" />
              <Stat icon={<CalendarClock className="size-4 text-ink-soft" />} label={t.problem.daysOpen} value={daysSince(problem.created_at)} tone="text-ink" />
            </dl>
            {owner && (
              <div
                className={`mt-6 flex items-center gap-3 rounded-2xl border p-4 text-base ${overdue ? "border-danger/20 bg-danger-soft/50 text-danger" : "border-brand/20 bg-brand/5 text-ink"}`}
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${overdue ? "bg-danger/10" : "bg-brand/10"}`}>
                  <UserRound className={`size-5 ${overdue ? "text-danger" : "text-brand"}`} />
                </div>
                <div>
                  <strong>{owner.display_name}</strong> {problem.status === "verified" ? t.problem.fixedThis : t.problem.handlingThis}
                  {problem.due_at && problem.status === "claimed" && (
                    <span className="opacity-80">
                      {" "}
                      · {overdue ? t.problem.overdueSince : t.problem.aimsToFinish} {formatDate(problem.due_at, locale)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <EventsPanel problem={problem} events={events ?? []} userId={userId} />

          <section className="glass-panel border-white/10 bg-surface/40 p-8">
            <h2 className="mb-6 text-2xl font-extrabold">{t.problem.timeline}</h2>
            <Timeline entries={timeline ?? []} userId={userId} moderator={moderator} />
            {userId && problem.status !== "archived" && (
              <div className="mt-8 border-t border-line/30 pt-8">
                <CommentForm problemId={problem.id} userId={userId} />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ProblemActions
            problem={problem}
            userId={userId}
            supported={!!support}
            myConfirmations={(mine ?? []).map((c) => c.kind)}
          />
          <ShareButtons title={problem.title} path={`/problems/${problem.id}`} fixed={fixed} />
          <PathPanel problem={problem} helpers={helpers ?? null} signedIn={!!userId} />
          <div className="card overflow-hidden">
            <ProblemsMap problems={[problem]} center={{ lat: problem.lat, lng: problem.lng }} zoom={16} className="h-56 w-full" />
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${problem.lat},${problem.lng}`}
              target="_blank"
              rel="noreferrer"
              className="block p-3 text-center text-sm font-semibold text-brand"
            >
              {t.problem.directions}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line/20 bg-surface/50 p-4">
      <dt className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-ink-soft uppercase">
        {icon} {label}
      </dt>
      <dd className={`text-3xl font-black ${tone}`}>{value}</dd>
    </div>
  );
}
