"use client";

import { Phone, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { EMERGENCY_NUMBERS } from "@/lib/taxonomy";

export function EmergencyBanner({ notes = [] }: { notes?: string[] }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger-soft p-4 text-danger" role="alert">
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-5" /> {t.danger.title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>{t.danger.keepAway}</li>
        <li>{t.danger.callNow}</li>
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {EMERGENCY_NUMBERS.map((e) => (
          <a key={e.number} href={`tel:${e.number}`} className="btn-danger">
            <Phone className="size-4" /> {t.taxonomy.emergency[e.key]} {e.number}
          </a>
        ))}
      </div>
    </div>
  );
}
