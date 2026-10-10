import Link from "next/link";
import { Bell, Map, Plus, UserRound, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

export async function SiteHeader() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  let unread = 0;
  if (userId) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    unread = count ?? 0;
  }

  return <HeaderShell signedIn={!!userId} unread={unread} />;
}

/** The header without session data; also the static fallback while the session loads. */
export function HeaderShell({ signedIn, unread = 0 }: { signedIn?: boolean; unread?: number }) {
  return (
    <header className="sticky top-0 z-[1000] border-b border-white/10 bg-bg/70 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="mr-auto flex items-center gap-3 font-bold tracking-tight group">
          <div className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-500 text-brand-ink shadow-[0_0_15px_rgba(48,165,140,0.4)] transition-transform duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(48,165,140,0.6)]">
            <span className="text-xl">स</span>
            <Sparkles className="absolute -top-1 -right-1 size-3 text-accent animate-pulse" />
          </div>
          <span className="text-xl tracking-tight transition-colors group-hover:text-brand">Sambhal</span>
        </Link>
        
        <Link href="/map" className="btn-secondary rounded-xl py-2 px-4 shadow-sm">
          <Map className="size-4" />
          <span className="hidden sm:inline font-semibold">Map</span>
        </Link>
        
        {signedIn === undefined ? (
          <span className="btn invisible" aria-hidden>
            Sign in
          </span>
        ) : signedIn ? (
          <Link href="/me" className="btn-secondary rounded-xl py-2 px-4 relative shadow-sm hover:text-brand hover:border-brand/30" aria-label="My activity">
            {unread > 0 ? <Bell className="size-4 animate-bounce" /> : <UserRound className="size-4" />}
            <span className="hidden sm:inline font-semibold">Me</span>
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        ) : (
          <Link href="/login" className="btn-secondary rounded-xl py-2 px-4 shadow-sm">
            Sign in
          </Link>
        )}
        
        <Link href="/report" className="btn-primary rounded-xl shadow-brand/20 shadow-lg">
          <Plus className="size-4" />
          <span className="font-semibold">Report</span>
        </Link>
      </div>
    </header>
  );
}
