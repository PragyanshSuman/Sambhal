import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Building2 } from "lucide-react";
import { getDictionary } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { AreaStats } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.areas.title, description: t.areas.intro };
}

export default async function AreasPage() {
  const t = await getDictionary();
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.rpc("area_stats").then((r) => ({ ...r, data: r.data as AreaStats[] | null }));
  const areas = data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t.areas.title}</h1>
      <p className="mt-2 text-ink-soft">{t.areas.intro}</p>
      {areas.length === 0 ? (
        <p className="card mt-8 p-6 text-center text-sm text-ink-soft">{t.areas.empty}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <Link key={a.slug} href={`/areas/${a.slug}`} className="card block p-5">
              <p className="flex items-center gap-2 text-lg font-bold">
                <Building2 className="size-5 text-brand" /> {a.locality}
              </p>
              {a.city && <p className="text-sm text-ink-soft">{a.city}</p>}
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <dd className="text-2xl font-black">{a.open}</dd>
                  <dt className="text-xs text-ink-soft">{t.areas.open}</dt>
                </div>
                <div>
                  <dd className="text-2xl font-black text-brand">{a.fixed}</dd>
                  <dt className="text-xs text-ink-soft">{t.areas.fixed}</dt>
                </div>
                <div>
                  <dd className="text-2xl font-black">{a.fix_rate ?? 0}%</dd>
                  <dt className="text-xs text-ink-soft">{t.areas.fixRate}</dt>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
