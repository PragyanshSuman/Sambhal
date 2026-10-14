import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { InstallButton } from "@/components/InstallButton";
import { ProblemCard } from "@/components/ProblemCard";
import { fmt } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { notificationText, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PROBLEM_CARD_COLUMNS, type ProblemCard as Card, type Profile } from "@/lib/types";
import { DataControls } from "./DataControls";
import { HelperForm, type HelperRow } from "./HelperForm";
import { MarkAllRead, ProfileForm } from "./ProfileForm";
import { PushToggle } from "./PushToggle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).nav.myActivity };
}

type Notification = { id: string; body: string; problem_id: string | null; read_at: string | null; created_at: string };

export default async function MePage() {
  const t = await getDictionary();
  const locale = await getLocale();
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/me");

  const [{ data: profile }, { data: notifications }, { data: reported }, { data: owned }, { data: helper }] = await Promise.all([
    supabase.from("profiles").select("id,display_name,area,reputation").eq("id", userId).single<Profile>(),
    supabase
      .from("notifications")
      .select("id,body,problem_id,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .overrideTypes<Notification[], { merge: false }>(),
    supabase
      .from("problems")
      .select(PROBLEM_CARD_COLUMNS)
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<Card[], { merge: false }>(),
    supabase
      .from("problems")
      .select(PROBLEM_CARD_COLUMNS)
      .eq("owner_id", userId)
      .order("last_activity_at", { ascending: false })
      .overrideTypes<Card[], { merge: false }>(),
    supabase.from("helpers").select("skills,radius_km,lat,lng,available,bio").eq("user_id", userId).maybeSingle<HelperRow>(),
  ]);

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const handling = (owned ?? []).filter((p) => p.status !== "verified");
  const fixed = (owned ?? []).filter((p) => p.status === "verified");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profile?.display_name ?? t.nav.myActivity}</h1>
          <p className="mt-1 text-ink-soft">
            {fmt(t.me.trustLine, { rep: profile?.reputation ?? 0, reported: reported?.length ?? 0, fixed: fixed.length })}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn-secondary">{t.common.signOut}</button>
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {t.me.notifications} {unread > 0 && <span className="chip ml-1 bg-accent text-white">{fmt(t.me.newCount, { n: unread })}</span>}
              </h2>
              {unread > 0 && <MarkAllRead />}
            </div>
            {notifications && notifications.length > 0 ? (
              <ul className="card mt-3 divide-y divide-line">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.problem_id ? `/problems/${n.problem_id}` : "/me"}
                      className={`flex items-start justify-between gap-3 p-3 text-sm hover:bg-surface-2 ${n.read_at ? "text-ink-soft" : "font-medium"}`}
                    >
                      <span className="flex items-start gap-2">
                        {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                        {notificationText(n.body, t)}
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">{timeAgo(n.created_at, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">{t.me.noNotifications}</p>
            )}
          </section>

          <Section title={t.me.handling} empty={t.me.handlingEmpty} items={handling} />
          <Section title={t.me.reportedByMe} empty={t.me.reportedEmpty} items={reported ?? []} />
          {fixed.length > 0 && <Section title={t.me.fixedByMe} empty="" items={fixed} />}
        </div>

        <aside className="space-y-6">
          <ProfileForm profile={profile ?? { id: userId, display_name: "", area: null, reputation: 0 }} />
          <PushToggle />
          <InstallButton variant="card" />
          <HelperForm userId={userId} helper={helper ?? null} />
          <DataControls userId={userId} />
        </aside>
      </div>
    </div>
  );
}

function Section({ title, empty, items }: { title: string; empty: string; items: Card[] }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((p) => (
            <ProblemCard key={p.id} problem={p} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">{empty}</p>
      )}
    </section>
  );
}
