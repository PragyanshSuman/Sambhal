import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Activity, ArrowRight, BarChart3, Camera, CheckCircle2, Hand, MapPin, ShieldCheck, Sparkles, Users, Wrench } from "lucide-react";
import { ProblemCard } from "@/components/ProblemCard";
import { fmt } from "@/i18n/config";
import { getDictionary } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PATHS, PATH_KEYS, RULES } from "@/lib/taxonomy";
import { PROBLEM_CARD_COLUMNS, type ProblemCard as Card } from "@/lib/types";

type Stats = {
  reported: number;
  open: number;
  in_progress: number;
  verified: number;
  helpers: number;
  median_days_to_fix: number | null;
};

const FLOW_ICONS = [Camera, Users, Hand, Wrench, CheckCircle2];

export default async function Home() {
  const t = await getDictionary();
  return (
    <div className="relative overflow-hidden selection:bg-brand/30 selection:text-brand-950">
      <div className="bg-blob top-[-200px] left-[-200px] h-[800px] w-[800px] bg-brand/30 mix-blend-multiply dark:mix-blend-screen" />
      <div className="bg-blob animation-delay-2000 top-[10%] right-[-100px] h-[600px] w-[600px] bg-accent/20 mix-blend-multiply dark:mix-blend-screen" />
      <div className="bg-blob animation-delay-4000 bottom-[-200px] left-[20%] h-[700px] w-[700px] bg-brand-400/20 mix-blend-multiply dark:mix-blend-screen" />

      <section className="animate-fade-up relative z-10 mx-auto max-w-6xl px-4 pt-24 pb-20 text-center sm:pt-36">
        <div className="mb-10 inline-flex cursor-default items-center gap-2 rounded-full border border-brand/30 bg-surface/50 px-5 py-2 text-sm font-semibold text-brand shadow-[0_0_25px_rgba(48,165,140,0.2)] backdrop-blur-md transition-transform hover:scale-105">
          <Sparkles className="animate-pulse-slow size-4 text-accent" />
          <span>{t.home.badge}</span>
        </div>

        <h1 className="mx-auto max-w-5xl text-5xl leading-[1.1] font-extrabold tracking-tighter sm:text-7xl md:text-8xl">
          {t.home.heroA}
          <br />
          <span className="text-gradient">{t.home.heroB}</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed font-medium text-ink-soft sm:text-xl md:text-2xl">{t.home.intro}</p>

        <div className="mt-12 flex flex-col flex-wrap justify-center gap-5 sm:flex-row">
          <Link href="/report" className="btn-primary group rounded-2xl px-10 py-5 text-lg font-bold shadow-2xl shadow-brand/30">
            {t.home.startReport}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/map" className="btn-secondary group rounded-2xl border-brand/20 bg-surface/80 px-10 py-5 text-lg font-bold backdrop-blur-xl">
            <MapPin className="size-5 text-brand transition-transform group-hover:-translate-y-1 group-hover:text-accent" />
            {t.home.exploreMap}
          </Link>
        </div>

        <Suspense fallback={<div className="mx-auto mt-20 h-[140px] max-w-4xl animate-pulse rounded-3xl bg-surface-2/50 backdrop-blur-md" />}>
          <LiveStats />
        </Suspense>
      </section>

      <section className="relative z-10 border-y border-line/30 bg-surface-2/30 py-32 backdrop-blur-3xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-20 flex flex-col items-center text-center">
            <div className="mb-6 flex size-16 items-center justify-center rounded-3xl bg-brand/10 text-brand shadow-inner">
              <Activity className="size-8" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t.home.howTitle}</h2>
            <p className="mx-auto mt-6 max-w-2xl text-xl font-medium text-ink-soft">{t.home.howBody}</p>
          </div>

          <div className="relative grid gap-6 md:grid-cols-5">
            <div className="absolute top-[45px] right-[10%] left-[10%] z-0 hidden h-0.5 bg-gradient-to-r from-brand/0 via-brand/30 to-brand/0 md:block" />
            {t.home.flow.map(({ title, body }, i) => {
              const Icon = FLOW_ICONS[i];
              return (
                <div key={title} className="glass-panel group relative z-10 border-white/20 bg-surface/60 p-8 backdrop-blur-2xl hover:-translate-y-2">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-brand/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative z-10">
                    <div className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-surface text-brand shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-brand group-hover:text-white group-hover:shadow-brand/40">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold tracking-tight">{title}</h3>
                    <p className="text-sm leading-relaxed font-medium text-ink-soft">{fmt(body, { n: RULES.confirmThreshold })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-32">
        <div className="mb-16 max-w-3xl">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t.home.pathsTitle}</h2>
          <p className="mt-6 text-xl font-medium text-ink-soft">{t.home.pathsBody}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PATH_KEYS.map((key) => (
            <div
              key={key}
              className="glass-panel group relative flex h-full flex-col overflow-hidden border-white/10 bg-surface/40 p-8 transition-all duration-300 hover:-translate-y-1 hover:bg-surface/80 hover:shadow-2xl"
            >
              <div
                className="absolute -top-4 -right-4 size-32 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
                style={{ backgroundColor: PATHS[key].color }}
              />
              <div className="relative z-10">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-xl border border-line/50 bg-surface shadow-md">
                    <span className="block size-4 rounded-full shadow-inner" style={{ backgroundColor: PATHS[key].color }} />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">{t.taxonomy.paths[key].label}</h3>
                </div>
                <p className="mb-8 flex-1 text-base leading-relaxed font-medium text-ink-soft">{t.taxonomy.paths[key].blurb}</p>
                <div className="mt-auto border-t border-line/50 pt-6">
                  <p className="text-xs font-bold tracking-widest text-ink/50 uppercase">{t.home.ledBy}</p>
                  <p className="mt-1 font-semibold text-ink">{t.taxonomy.paths[key].who}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Suspense fallback={<div className="py-32" />}>
        <LatestReports />
      </Suspense>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-32">
        <div className="glass-panel relative flex flex-col items-center gap-10 overflow-hidden border-white/20 bg-gradient-to-br from-brand/10 via-brand/5 to-accent/10 p-10 shadow-2xl sm:p-16 md:flex-row">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck className="size-64" />
          </div>
          <div className="relative z-10 shrink-0">
            <div className="flex size-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-brand to-brand-600 text-white shadow-[0_0_40px_rgba(48,165,140,0.5)]">
              <ShieldCheck className="size-12" />
            </div>
          </div>
          <div className="relative z-10 flex-1 text-center md:text-left">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{t.home.ctaTitle}</h2>
            <p className="max-w-2xl text-xl leading-relaxed font-medium text-ink-soft">{t.home.ctaBody}</p>
          </div>
          <div className="relative z-10 mt-6 shrink-0 md:mt-0">
            <Link href="/me#helper" className="btn-primary rounded-2xl px-10 py-5 text-lg font-bold shadow-2xl shadow-brand/40 transition-transform hover:scale-105">
              {t.home.ctaButton}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

async function LiveStats() {
  const t = await getDictionary();
  await connection();
  const supabase = await createClient();
  const { data: stats } = await supabase.rpc("public_stats").single<Stats>();
  const s = stats ?? { reported: 0, in_progress: 0, verified: 0, helpers: 0 };

  return (
    <Link href="/impact" className="glass-panel group relative mx-auto mt-20 block max-w-5xl overflow-hidden border-white/20 bg-surface/50 p-8 shadow-2xl sm:p-12">
      <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-accent/5 opacity-50" />
      <dl className="relative z-10 grid grid-cols-2 gap-x-8 gap-y-12 divide-line/30 sm:grid-cols-4 sm:divide-x">
        {(
          [
            [t.home.stats.reported, s.reported],
            [t.home.stats.inProgress, s.in_progress],
            [t.home.stats.fixed, s.verified],
            [t.home.stats.helpers, s.helpers],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col items-center justify-center px-4">
            <dd className="mb-3 bg-gradient-to-br from-ink to-ink-soft bg-clip-text text-5xl font-black tracking-tighter text-transparent tabular-nums drop-shadow-sm sm:text-6xl dark:from-white dark:to-white/50">
              {value}
            </dd>
            <dt className="text-center text-sm font-bold tracking-widest text-ink-soft uppercase">{label}</dt>
          </div>
        ))}
      </dl>
      <p className="relative z-10 mt-8 flex items-center justify-center gap-1 text-sm font-semibold text-brand">
        <BarChart3 className="size-4" /> {t.nav.impact} →
      </p>
    </Link>
  );
}

async function LatestReports() {
  const t = await getDictionary();
  await connection();
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("problems")
    .select(PROBLEM_CARD_COLUMNS)
    .neq("status", "archived")
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(4)
    .overrideTypes<Card[], { merge: false }>();

  if (!recent || recent.length === 0) return null;

  return (
    <section className="relative z-10 mx-auto mb-32 max-w-7xl rounded-[3rem] border border-white/10 bg-gradient-to-b from-surface-2/10 to-surface-2/40 py-32 shadow-xl backdrop-blur-xl">
      <div className="mb-16 flex flex-col items-end justify-between gap-6 px-4 sm:flex-row md:px-8">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-extrabold tracking-tight">{t.home.recentTitle}</h2>
          <p className="mt-4 text-xl font-medium text-ink-soft">{t.home.recentBody}</p>
        </div>
        <Link href="/map" className="btn-secondary group rounded-xl px-6 py-3 whitespace-nowrap shadow-sm">
          <span className="font-semibold">{t.home.viewMap}</span> <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="grid gap-6 px-4 md:grid-cols-2 md:px-8 lg:grid-cols-4">
        {recent.map((p) => (
          <ProblemCard key={p.id} problem={p} />
        ))}
      </div>
    </section>
  );
}
