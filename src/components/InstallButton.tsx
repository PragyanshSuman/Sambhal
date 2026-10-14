"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install app" for Android/desktop Chrome; instructions on iPhone; nothing once installed. */
export function InstallButton({ variant = "link" }: { variant?: "link" | "card" }) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [state, setState] = useState<"unknown" | "installed" | "ios" | "other">("unknown");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // Reading the device once on mount; there's no external store to subscribe to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(standalone ? "installed" : ios ? "ios" : "other");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setState("installed");
    setPrompt(null);
  }

  if (variant === "link") {
    if (!prompt) return null;
    return (
      <button onClick={install} className="inline-flex items-center gap-1 underline">
        <Download className="size-3.5" /> {t.footer.install}
      </button>
    );
  }

  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">{t.me.install.title}</h2>
      <p className="text-sm text-ink-soft">{t.me.install.help}</p>
      {state === "installed" ? (
        <p className="text-sm font-semibold text-brand">{t.me.install.installed}</p>
      ) : prompt ? (
        <button onClick={install} className="btn-primary w-full">
          <Download className="size-4" /> {t.me.install.button}
        </button>
      ) : state === "ios" ? (
        <p className="text-sm">{t.me.install.ios}</p>
      ) : null}
    </section>
  );
}
