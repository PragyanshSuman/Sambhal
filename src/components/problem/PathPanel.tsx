"use client";

import { Check, Copy, FileText, Lightbulb, RotateCcw, ShieldAlert, Users } from "lucide-react";
import { useState } from "react";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { useI18n } from "@/i18n/client";
import { fmt, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { draftText, type DraftKind } from "@/lib/drafts";
import { PATHS, type Skill } from "@/lib/taxonomy";
import type { Problem } from "@/lib/types";

export type NearbyHelper = { display_name: string; skills: string[]; distance_km: number; reputation: number };

const DRAFTS: Partial<Record<Problem["path"], DraftKind[]>> = {
  owner: ["owner_notice"],
  collective: ["collective_ask", "rti"],
  funding: ["appeal"],
};

export function PathPanel({
  problem,
  helpers,
  signedIn,
}: {
  problem: Problem;
  helpers: NearbyHelper[] | null;
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const path = t.taxonomy.paths[problem.path];
  const done = problem.status === "verified" || problem.status === "archived";
  const tip = t.guidance.tips[problem.category];
  const safety = (t.guidance.safety as Record<string, string>)[problem.category];

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line p-5" style={{ borderTop: `4px solid ${PATHS[problem.path].color}` }}>
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.path.label}</p>
        <h2 className="mt-1 text-lg font-bold">{path.label}</h2>
        <p className="mt-1 text-sm text-ink-soft">{path.blurb}</p>
      </div>

      {!done && (
        <div className="space-y-4 p-5">
          {problem.path === "danger" ? (
            <EmergencyBanner notes={safety ? [safety] : []} />
          ) : (
            <>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {t.guidance.steps[problem.path].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {tip && (
                <p className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm">
                  <Lightbulb className="size-4 shrink-0 text-accent" /> {tip}
                </p>
              )}
              {safety && (
                <p className="flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
                  <ShieldAlert className="size-4 shrink-0" /> {safety}
                </p>
              )}
            </>
          )}

          {problem.skills_needed.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold">{t.path.skillsNeeded}</span>{" "}
              {problem.skills_needed.map((s) => t.taxonomy.skills[s as Skill] ?? s).join(", ")}
            </p>
          )}

          {helpers && (
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4" /> {fmt(t.path.helpersNearby, { n: helpers.length })}
              </p>
              {helpers.length === 0 ? (
                <p className="mt-1 text-sm text-ink-soft">{t.path.noHelpers}</p>
              ) : (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {helpers.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-medium">{h.display_name}</span>
                        <span className="block text-xs text-ink-soft">
                          {h.skills.map((s) => t.taxonomy.skills[s as Skill] ?? s).join(", ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {h.distance_km} {t.common.km}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {signedIn && DRAFTS[problem.path]?.map((kind) => <DraftBox key={kind} problem={problem} kind={kind} />)}
        </div>
      )}
    </section>
  );
}

function DraftBox({ problem, kind }: { problem: Problem; kind: DraftKind }) {
  const { t, locale } = useI18n();
  const [draftLocale, setDraftLocale] = useState<Locale>(locale);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const label = t.path.drafts[kind];

  function generate(lang: Locale) {
    setDraftLocale(lang);
    setText(draftText(kind, problem, `${window.location.origin}/problems/${problem.id}`, lang));
  }

  if (!text) {
    return (
      <button className="btn-secondary w-full" onClick={() => generate(draftLocale)}>
        <FileText className="size-4" /> {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line p-2 text-xs">
        <span className="font-semibold">{label}</span>
        <select
          className="rounded-lg border border-line bg-surface px-2 py-1"
          value={draftLocale}
          onChange={(e) => generate(e.target.value as Locale)}
          aria-label={t.path.draftLanguage}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="block min-h-56 w-full resize-y bg-surface p-3 font-mono text-xs outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={label}
      />
      <div className="flex gap-2 border-t border-line p-2">
        <button
          className="btn-secondary flex-1"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t.common.copied : t.common.copy}
        </button>
        <a className="btn-secondary flex-1" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          {t.common.whatsapp}
        </a>
        <button className="btn-secondary" onClick={() => generate(draftLocale)} aria-label={t.path.redo}>
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}
