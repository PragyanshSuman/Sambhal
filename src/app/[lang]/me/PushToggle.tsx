"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentSubscription, pushSupported, subscribePush, unsubscribePush, VAPID_PUBLIC_KEY } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "unsupported" | "off" | "on" | "denied">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) {
      // Feature detection can only happen in the browser, after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    currentSubscription().then((sub) => setState(sub ? "on" : "off"));
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (state === "on") {
        await unsubscribePush(supabase);
        setState("off");
      } else {
        await subscribePush(supabase);
        setState("on");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "denied") setState("denied");
      else setError(t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">{t.me.push.title}</h2>
      <p className="text-sm text-ink-soft">{t.me.push.help}</p>
      {!VAPID_PUBLIC_KEY ? (
        <p className="text-sm text-ink-soft">{t.me.push.notConfigured}</p>
      ) : state === "unsupported" ? (
        <p className="text-sm">{t.me.push.unsupported}</p>
      ) : state === "denied" ? (
        <p className="text-sm text-danger">{t.me.push.denied}</p>
      ) : (
        <>
          {state === "on" && <p className="text-sm font-semibold text-brand">{t.me.push.on}</p>}
          <button onClick={toggle} disabled={busy || state === "loading"} className={state === "on" ? "btn-secondary w-full" : "btn-primary w-full"}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : state === "on" ? <BellOff className="size-4" /> : <Bell className="size-4" />}
            {state === "on" ? t.me.push.disable : t.me.push.enable}
          </button>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
