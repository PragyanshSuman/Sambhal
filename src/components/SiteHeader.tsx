import Link from "next/link";
import { connection } from "next/server";
import { Bell, Building2, Map, Plus, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function SiteHeader() {
  const t = await getDictionary();
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  let unread = 0;
  let moderator = false;
  if (userId) {
    const [{ count }, { data: mod }] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      supabase.from("moderators").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    unread = count ?? 0;
    moderator = !!mod;
  }

  return <HeaderShell t={t} signedIn={!!userId} unread={unread} moderator={moderator} />;
}

/** The header without session data; also the static fallback while the session loads. */
export function HeaderShell({
  t,
  signedIn,
  unread = 0,
  moderator = false,
}: {
  t: Dictionary;
  signedIn?: boolean;
  unread?: number;
  moderator?: boolean;
}) {
  return (
    <header className="sticky top-0 z-[1000] border-b border-white/10 bg-bg/70 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
        <Link href="/" className="group mr-auto flex items-center gap-3 font-bold tracking-tight">
          <div className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-500 text-brand-ink shadow-[0_0_15px_rgba(48,165,140,0.4)] transition-transform duration-300 group-hover:scale-105">
            <span className="text-xl">स</span>
            <Sparkles className="absolute -top-1 -right-1 size-3 animate-pulse text-accent" />
          </div>
          <span className="hidden text-xl tracking-tight transition-colors group-hover:text-brand sm:inline">Sambhal</span>
        </Link>

        <Link href="/map" className="btn-secondary rounded-xl px-3 py-2 shadow-sm" aria-label={t.nav.map}>
          <Map className="size-4" />
          <span className="hidden font-semibold md:inline">{t.nav.map}</span>
        </Link>
        <Link href="/areas" className="btn-secondary hidden rounded-xl px-3 py-2 shadow-sm sm:inline-flex" aria-label={t.nav.areas}>
          <Building2 className="size-4" />
          <span className="hidden font-semibold lg:inline">{t.nav.areas}</span>
        </Link>
        {moderator && (
          <Link href="/admin" className="btn-secondary rounded-xl px-3 py-2 shadow-sm" aria-label={t.nav.admin}>
            <ShieldCheck className="size-4" />
          </Link>
        )}

        {signedIn === undefined ? (
          <span className="btn invisible" aria-hidden>
            {t.common.signIn}
          </span>
        ) : signedIn ? (
          <Link
            href="/me"
            className="btn-secondary relative rounded-xl px-3 py-2 shadow-sm hover:border-brand/30 hover:text-brand"
            aria-label={t.nav.myActivity}
          >
            {unread > 0 ? <Bell className="size-4" /> : <UserRound className="size-4" />}
            <span className="hidden font-semibold md:inline">{t.nav.me}</span>
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        ) : (
          <Link href="/login" className="btn-secondary rounded-xl px-3 py-2 shadow-sm">
            {t.common.signIn}
          </Link>
        )}

        <LanguageSwitcher className="hidden sm:inline-flex" />

        <Link href="/report" className="btn-primary rounded-xl px-3 shadow-lg shadow-brand/20 sm:px-5">
          <Plus className="size-4" />
          <span className="font-semibold">{t.nav.report}</span>
        </Link>
      </div>
    </header>
  );
}
