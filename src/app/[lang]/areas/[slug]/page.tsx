import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { Medal } from "lucide-react";
import { ProblemCard } from "@/components/ProblemCard";
import { fmt } from "@/i18n/config";
import { getDictionary } from "@/i18n/server";
import { daysSince, isoDaysAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STATUSES } from "@/lib/taxonomy";
import { PROBLEM_CARD_COLUMNS, type AreaStats, type ProblemCard as Card } from "@/lib/types";
import { DigestButton } from "./DigestButton";

const getArea = cache(async (slug: string) => {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.rpc("area_stats").then((r) => ({ ...r, data: r.data as AreaStats[] | null }));
  return data?.find((a) => a.slug === slug) ?? null;
});

export async function generateMetadata(props: PageProps<"/[lang]/areas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const area = await getArea(slug);
  const t = await getDictionary();
  return area ? { title: area.locality, description: t.areas.intro } : { title: t.problem.notFoundTitle };
}

type Leader = { display_name: string; fixes: number; confirmations: number; reputation: number };

export default async function AreaPage(props: PageProps<"/[lang]/areas/[slug]">) {
  const { slug } = await props.params;
  const t = await getDictionary();
  const area = await getArea(slug);
  if (!area) notFound();

  const supabase = await createClient();
  const weekAgo = isoDaysAgo(7);
  const [{ data: leaders }, { data: oldest }, { data: recentFixed }, { data: open }, { count: newThisWeek }, { count: fixedThisWeek }] =
    await Promise.all([
      supabase.rpc("area_leaderboard", { p_slug: slug }).then((r) => ({ ...r, data: r.data as Leader[] | null })),
      supabase
        .from("problems")
        .select(PROBLEM_CARD_COLUMNS)
        .eq("locality_slug", slug)
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: true })
        .limit(3)
        .overrideTypes<Card[], { merge: false }>(),
      supabase
        .from("problems")
        .select(PROBLEM_CARD_COLUMNS)
        .eq("locality_slug", slug)
        .eq("status", "verified")
        .order("verified_at", { ascending: false })
        .limit(4)
        .overrideTypes<Card[], { merge: false }>(),
      supabase
        .from("problems")
        .select(PROBLEM_CARD_COLUMNS)
        .eq("locality_slug", slug)
        .in("status", OPEN_STATUSES)
        .order("last_activity_at", { ascending: false })
        .limit(20)
        .overrideTypes<Card[], { merge: false }>(),
      supabase.from("problems").select("id", { count: "exact", head: true }).eq("locality_slug", slug).gte("created_at", weekAgo),
      supabase.from("problems").select("id", { count: "exact", head: true }).eq("locality_slug", slug).gte("verified_at", weekAgo),
    ]);

  const stats: [string, string | number][] = [
    [t.areas.reported, area.reported],
    [t.areas.open, area.open],
    [t.areas.fixed, area.fixed],
    [t.areas.fixedThisMonth, area.fixed_this_month],
    [t.areas.medianDays, area.median_days_to_fix ?? "–"],
    [t.areas.fixRate, `${area.fix_rate ?? 0}%`],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-ink-soft">
        <Link href="/areas" className="underline">{t.areas.title}</Link>
        {area.city && ` · ${area.city}`}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-black tracking-tight">{area.locality}</h1>
        <DigestButton
          area={area.locality}
          newCount={newThisWeek ?? 0}
          fixedCount={fixedThisWeek ?? 0}
          oldest={(oldest ?? []).map((p) => ({ id: p.id, title: p.title, days: daysSince(p.created_at) }))}
          slug={slug}
        />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-4 text-center">
            <dd className="text-3xl font-black">{value}</dd>
            <dt className="mt-1 text-xs text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          {oldest && oldest.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">{t.areas.longestOpen}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {oldest.map((p) => (
                  <ProblemCard key={p.id} problem={p} />
                ))}
              </div>
            </section>
          )}
          {recentFixed && recentFixed.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">{t.areas.recentlyFixed}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {recentFixed.map((p) => (
                  <ProblemCard key={p.id} problem={p} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="text-lg font-bold">{t.areas.openProblems}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(open ?? []).map((p) => (
                <ProblemCard key={p.id} problem={p} />
              ))}
            </div>
          </section>
        </div>

        <aside>
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Medal className="size-5 text-accent" /> {t.areas.leaderboard}
            </h2>
            {leaders && leaders.length > 0 ? (
              <ol className="mt-3 divide-y divide-line">
                {leaders.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.display_name}</span>
                      <span className="text-xs text-ink-soft">
                        {l.fixes} {t.areas.fixes} · {l.confirmations} {t.areas.checks}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">{t.areas.noLeaders}</p>
            )}
          </section>
          <p className="mt-3 text-xs text-ink-soft">{fmt(t.areas.digestTitle, { area: area.locality })}</p>
        </aside>
      </div>
    </div>
  );
}
