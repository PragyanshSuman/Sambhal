"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // URLs carry no language, so a reload is what switches every cached page over.
    const { pathname, search, hash } = window.location;
    const stripped = pathname.replace(/^\/(en|hi)(?=\/|$)/, "") || "/";
    window.location.assign(stripped + search + hash);
  }

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t.nav.language}</span>
      <Languages className="pointer-events-none absolute left-2.5 size-4 text-ink-soft" />
      <select
        value={locale}
        onChange={(e) => choose(e.target.value as Locale)}
        className="h-9 cursor-pointer appearance-none rounded-xl border border-line bg-surface/50 py-1 pr-3 pl-8 text-sm font-semibold"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
