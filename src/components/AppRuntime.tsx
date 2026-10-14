"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Background plumbing for every page, all free and first-party:
 * - registers the service worker (offline page + push notifications)
 * - counts page views per path per day (no cookies, no user ids)
 * - reports browser errors to /api/client-errors
 */
export function AppRuntime() {
  const pathname = usePathname();
  const supabase = useRef<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }

    let sent = 0;
    function report(message: string, stack?: string) {
      if (sent++ > 5) return; // one bad page shouldn't flood the logs
      const body = JSON.stringify({ message: message.slice(0, 500), stack: stack?.slice(0, 2000), url: location.pathname });
      navigator.sendBeacon?.("/api/client-errors", new Blob([body], { type: "application/json" }));
    }
    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) =>
      report(e.reason instanceof Error ? e.reason.message : String(e.reason), e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (navigator.doNotTrack === "1") return;
    supabase.current ??= createClient();
    const path = pathname.replace(/^\/(en|hi)(?=\/|$)/, "") || "/";
    supabase.current.rpc("track_view", { p_path: path }).then(() => {});
  }, [pathname]);

  return null;
}
