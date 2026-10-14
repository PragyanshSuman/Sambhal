import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ProblemCard } from "@/components/ProblemCard";
import { getDictionary } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STATUSES } from "@/lib/taxonomy";
import { PROBLEM_CARD_COLUMNS, type AreaStats, type ProblemCard as Card } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.impact.title, description: t.impact.intro };
}

type Stats = { reported: number; open: number; in_progress: number; verified: number; helpers: number; median_days_to_fix: number | null };
type Fixed = { id: string; title: string; locality: string | null; photos: string[] };

export default async function ImpactPage() {
  const t = await getDictionary();
  await connection();
  const supabase = await createClient();

  const [{ data: stats }, { data: areas }, { data: fixed }, { data: longest }] = await Promise.all([
    supabase.rpc("public_stats").single<Stats>(),
    supabase.rpc("area_stats").then((r) => ({ ...r, data: r.data as AreaStats[] | null })),
    supabase
      .from("problems")
      .select("id,title,locality,photos")
      .eq("status", "verified")
      .not("photos", "eq", "{}")
      .order("verified_at", { ascending: false })
      .limit(6)
      .overrideTypes<Fixed[], { merge: false }>(),
    supabase
      .from("problems")
      .select(PROBLEM_CARD_COLUMNS)
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: true })
      .limit(6)
      .overrideTypes<Card[], { merge: false }>(),
  ]);

  const { data: afters } = fixed?.length
    ? await supabase
        .from("updates")
        .select("problem_id,photo_url")
        .eq("kind", "resolution")
        .in("problem_id", fixed.map((f) => f.id))
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
    : { data: [] as { problem_id: string; photo_url: string }[] };
  const afterFor = (id: string) => afters?.find((a) => a.problem_id === id)?.photo_url;
  const pairs = (fixed ?? []).filter((f) => afterFor(f.id));

  const totals: [string, string | number][] = [
    [t.home.stats.reported, stats?.reported ?? 0],
    [t.areas.open, stats?.open ?? 0],
    [t.home.stats.inProgress, stats?.in_progress ?? 0],
    [t.home.stats.fixed, stats?.verified ?? 0],
    [t.areas.medianDays, stats?.median_days_to_fix ?? "–"],
    [t.home.stats.helpers, stats?.helpers ?? 0],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t.impact.title}</h1>
      <p className="mt-2 max-w-3xl text-ink-soft">{t.impact.intro}</p>

      <h2 className="mt-10 text-lg font-bold">{t.impact.totals}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {totals.map(([label, value]) => (
          <div key={label} className="card p-4 text-center">
            <dd className="text-3xl font-black">{value}</dd>
            <dt className="mt-1 text-xs text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      {pairs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold">{t.impact.beforeAfter}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {pairs.map((f) => (
              <Link key={f.id} href={`/problems/${f.id}`} className="card block overflow-hidden">
                <div className="grid grid-cols-2">
                  {[
                    [f.photos[0], t.impact.before],
                    [afterFor(f.id)!, t.impact.after],
                  ].map(([src, label]) => (
                    <div key={label} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- user photos */}
                      <img src={src} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-0.5 text-xs font-bold text-white">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="p-3 text-sm font-semibold">
                  {f.title}
                  {f.locality && <span className="font-normal text-ink-soft"> · {f.locality}</span>}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {areas && areas.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold">{t.impact.byArea}</h2>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-ink-soft">
                <tr>
                  <th className="p-3">{t.areas.title}</th>
                  <th className="p-3 text-right">{t.areas.reported}</th>
                  <th className="p-3 text-right">{t.areas.open}</th>
                  <th className="p-3 text-right">{t.areas.fixed}</th>
                  <th className="p-3 text-right">{t.areas.fixedThisMonth}</th>
                  <th className="p-3 text-right">{t.areas.medianDays}</th>
                  <th className="p-3 text-right">{t.areas.fixRate}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {areas.map((a) => (
                  <tr key={a.slug}>
                    <td className="p-3 font-semibold">
                      <Link href={`/areas/${a.slug}`} className="underline">{a.locality}</Link>
                      {a.city && <span className="font-normal text-ink-soft"> · {a.city}</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{a.reported}</td>
                    <td className="p-3 text-right tabular-nums">{a.open}</td>
                    <td className="p-3 text-right tabular-nums">{a.fixed}</td>
                    <td className="p-3 text-right tabular-nums">{a.fixed_this_month}</td>
                    <td className="p-3 text-right tabular-nums">{a.median_days_to_fix ?? "–"}</td>
                    <td className="p-3 text-right tabular-nums">{a.fix_rate ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {longest && longest.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold">{t.impact.longestOpen}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {longest.map((p) => (
              <ProblemCard key={p.id} problem={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
