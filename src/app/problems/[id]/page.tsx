import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, MapPin, Users, UserRound } from "lucide-react";
import { PathBadge, SeverityBadge, StatusBadge, categoryLabel } from "@/components/Badges";
import { ProblemsMap } from "@/components/map";
import { CommentForm } from "@/components/problem/CommentForm";
import { PathPanel, type NearbyHelper } from "@/components/problem/PathPanel";
import { ProblemActions } from "@/components/problem/ProblemActions";
import { ShareButtons } from "@/components/problem/ShareButtons";
import { StatusStepper } from "@/components/problem/StatusStepper";
import { Timeline } from "@/components/problem/Timeline";
import { daysSince, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import type { Problem, Profile, TimelineEntry } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getProblem(id: string) {
  if (!UUID.test(id)) return null;
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.from("problems").select("*").eq("id", id).maybeSingle<Problem>();
  return data;
}

export async function generateMetadata(props: PageProps<"/problems/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const problem = await getProblem(id);
  if (!problem) return { title: "Not found" };
  const description = `${categoryLabel(problem.category)}. Confirmed by ${problem.confirm_count} peers, supported by ${problem.support_count}. Can you help?`;
  return {
    title: problem.title,
    description,
    openGraph: { title: problem.title, description, images: problem.photos.slice(0, 1) },
  };
}

export default async function ProblemPage(props: PageProps<"/problems/[id]">) {
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;
  const problem = await getProblem(id);
  if (!problem) notFound();

  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = (auth?.claims?.sub as string | undefined) ?? null;

  const [{ data: timeline }, { data: people }, { data: support }, { data: mine }, { data: helpers }] = await Promise.all([
    supabase
      .from("updates")
      .select("id,kind,body,photo_url,meta,created_at,user_id,profiles(display_name)")
      .eq("problem_id", problem.id)
      .order("created_at", { ascending: true })
      .overrideTypes<TimelineEntry[], { merge: false }>(),
    supabase
      .from("profiles")
      .select("id,display_name,area,reputation")
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
  ]);

  const reporter = people?.find((p) => p.id === problem.reporter_id);
  const owner = problem.owner_id ? people?.find((p) => p.id === problem.owner_id) : null;
  const overdue = problem.due_at && problem.status === "claimed" && new Date(problem.due_at) < new Date();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {isNew && (
        <p className="mb-6 rounded-xl bg-brand-soft p-4 text-sm">
          <strong className="text-brand">Posted.</strong> Now share it with peers: it needs 2 people on the spot to
          confirm it, and someone to take it on.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <div className="glass-panel p-8 md:p-10 relative overflow-hidden bg-gradient-to-br from-surface/80 to-surface-2/40 border-white/20">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <MapPin className="size-64 text-brand" />
            </div>
            <div className="relative z-10">
              <div className="flex flex-wrap gap-2 mb-4">
                <StatusBadge status={problem.status} />
                <PathBadge path={problem.path} />
                <SeverityBadge severity={problem.severity} />
              </div>
              <h1 className="text-4xl sm:text-5xl font-black leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-ink to-ink-soft dark:from-white dark:to-white/70 mb-4">{problem.title}</h1>
              <p className="flex flex-wrap gap-x-5 gap-y-2 text-base font-medium text-ink-soft bg-surface/50 backdrop-blur-sm rounded-xl py-2 px-4 border border-line/20 inline-flex">
                <span className="text-brand">{categoryLabel(problem.category)}</span>
                <span className="text-line/40">•</span>
                <span>
                  Reported by <strong className="text-ink">{reporter?.display_name ?? "a peer"}</strong> {timeAgo(problem.created_at)}
                </span>
                {problem.address && (
                  <>
                    <span className="text-line/40">•</span>
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      <MapPin className="size-4 text-brand" /> {problem.address}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {problem.photos.length > 0 && (
            <div className={`grid gap-3 ${problem.photos.length > 1 ? "grid-cols-2" : ""}`}>
              {problem.photos.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className={`group relative overflow-hidden rounded-3xl shadow-xl border border-white/10 block ${i === 0 && problem.photos.length === 3 ? "col-span-2" : ""}`}>
                  <div className="absolute inset-0 bg-brand/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 mix-blend-overlay" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- user photo from Supabase Storage */}
                  <img src={src} alt={`Photo ${i + 1} of the problem`} className="max-h-[32rem] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </a>
              ))}
            </div>
          )}

          {problem.description && (
            <div className="glass-panel p-8 bg-surface/60 border-white/10">
              <h3 className="text-sm font-bold tracking-widest text-ink-soft uppercase mb-4">Description</h3>
              <p className="whitespace-pre-wrap text-lg leading-relaxed font-medium">{problem.description}</p>
            </div>
          )}

          <div className="glass-panel p-8 bg-gradient-to-b from-surface/60 to-surface-2/40 border-white/10 shadow-lg">
            <StatusStepper status={problem.status} />
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line/30 pt-8 text-center">
              <div className="flex flex-col items-center p-4 rounded-2xl bg-surface/50 border border-line/20 hover:bg-surface transition-colors">
                <dt className="flex items-center gap-2 text-sm font-bold text-ink-soft uppercase tracking-wide mb-2">
                  <CheckCircle2 className="size-4 text-brand" /> Confirmed
                </dt>
                <dd className="text-3xl font-black text-brand">{problem.confirm_count}</dd>
              </div>
              <div className="flex flex-col items-center p-4 rounded-2xl bg-surface/50 border border-line/20 hover:bg-surface transition-colors">
                <dt className="flex items-center gap-2 text-sm font-bold text-ink-soft uppercase tracking-wide mb-2">
                  <Users className="size-4 text-accent" /> Affected
                </dt>
                <dd className="text-3xl font-black text-accent">{problem.support_count}</dd>
              </div>
              <div className="flex flex-col items-center p-4 rounded-2xl bg-surface/50 border border-line/20 hover:bg-surface transition-colors">
                <dt className="flex items-center gap-2 text-sm font-bold text-ink-soft uppercase tracking-wide mb-2">
                  <CalendarClock className="size-4 text-ink-soft" /> Days open
                </dt>
                <dd className="text-3xl font-black text-ink">{daysSince(problem.created_at)}</dd>
              </div>
            </dl>
            {owner && (
              <div className={`mt-6 rounded-2xl p-4 text-base flex items-center gap-3 border ${overdue ? "bg-danger-soft/50 border-danger/20 text-danger" : "bg-brand/5 border-brand/20 text-ink"}`}>
                <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${overdue ? "bg-danger/10" : "bg-brand/10"}`}>
                  <UserRound className={`size-5 ${overdue ? "text-danger" : "text-brand"}`} />
                </div>
                <div>
                  <strong>{owner.display_name}</strong> {problem.status === "verified" ? "fixed this" : "is handling this"}
                  {problem.due_at && problem.status === "claimed" && (
                    <span className="opacity-80"> · {overdue ? "overdue since" : "aims to finish"} {new Date(problem.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <section className="glass-panel p-8 bg-surface/40 border-white/10">
            <h2 className="text-2xl font-extrabold mb-6">Timeline</h2>
            <div className="mt-4">
              <Timeline entries={timeline ?? []} />
            </div>
            {userId && problem.status !== "archived" && (
              <div className="mt-8 pt-8 border-t border-line/30">
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
          <ShareButtons title={problem.title} path={`/problems/${problem.id}`} />
          <PathPanel problem={problem} helpers={helpers ?? null} signedIn={!!userId} />
          <div className="card overflow-hidden">
            <ProblemsMap
              problems={[problem]}
              center={{ lat: problem.lat, lng: problem.lng }}
              zoom={16}
              className="h-56 w-full"
            />
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${problem.lat},${problem.lng}`}
              target="_blank"
              rel="noreferrer"
              className="block p-3 text-center text-sm font-semibold text-brand"
            >
              Get directions →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
