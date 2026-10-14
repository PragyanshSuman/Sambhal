"use client";

import { Loader2, LocateFixed } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/problem/useAction";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { currentPosition, geoMessage, type LatLng } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { SKILL_KEYS, type Skill } from "@/lib/taxonomy";

export type HelperRow = {
  skills: Skill[];
  radius_km: number;
  lat: number;
  lng: number;
  available: boolean;
  bio: string | null;
};

export function HelperForm({ userId, helper }: { userId: string; helper: HelperRow | null }) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const { busy, error, run, setError } = useAction();
  const [skills, setSkills] = useState<Skill[]>(helper?.skills ?? []);
  const [radius, setRadius] = useState(helper?.radius_km ?? 3);
  const [base, setBase] = useState<LatLng | null>(helper ? { lat: helper.lat, lng: helper.lng } : null);
  const [available, setAvailable] = useState(helper?.available ?? true);
  const [bio, setBio] = useState(helper?.bio ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <form
      id="helper"
      className="card scroll-mt-20 space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        if (!base) {
          setError(t.me.setBase);
          return;
        }
        const ok = await run("helper", async () => {
          const { error } = await supabase.from("helpers").upsert({
            user_id: userId,
            skills,
            radius_km: radius,
            lat: base.lat,
            lng: base.lng,
            available,
            bio: bio.trim() || null,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;
        });
        setSaved(ok);
      }}
    >
      <div>
        <h2 className="font-bold">{t.me.helperTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.me.helperHelp}</p>
      </div>

      <fieldset>
        <legend className="label">{t.me.skills}</legend>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_KEYS.map((k) => {
            const on = skills.includes(k);
            return (
              <button
                type="button"
                key={k}
                aria-pressed={on}
                onClick={() => setSkills((s) => (on ? s.filter((x) => x !== k) : [...s, k]))}
                className={`chip border py-1 ${on ? "border-brand bg-brand text-brand-ink" : "border-line text-ink-soft"}`}
              >
                {t.taxonomy.skills[k]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <span className="label">{t.me.baseLocation}</span>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() =>
            currentPosition()
              .then((p) => setBase({ lat: p.lat, lng: p.lng }))
              .catch((e) => setError(geoMessage(e, t)))
          }
        >
          <LocateFixed className="size-4" /> {base ? t.me.locationSet : t.me.useCurrent}
        </button>
      </div>

      <div>
        <label className="label" htmlFor="radius">{fmt(t.me.howFar, { n: radius })}</label>
        <input id="radius" type="range" min={1} max={20} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
      </div>

      <div>
        <label className="label" htmlFor="bio">{t.me.about}</label>
        <input id="bio" className="input" maxLength={280} placeholder={t.me.aboutPlaceholder} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        {t.me.available}
      </label>

      <button className="btn-primary w-full" disabled={!!busy || skills.length === 0}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {saved ? t.common.saved : helper ? t.me.update : t.me.register}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
