import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).offline.title, robots: { index: false } };
}

// Cached by the service worker and shown when a page can't load without a connection.
export default async function OfflinePage() {
  const t = await getDictionary();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <WifiOff className="mx-auto size-10 text-ink-soft" />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{t.offline.title}</h1>
      <p className="mt-2 text-ink-soft">{t.offline.body}</p>
    </div>
  );
}
