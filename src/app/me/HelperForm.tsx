"use client";

import { Loader2, LocateFixed } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/problem/useAction";
import { currentPosition, type LatLng } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { SKILLS, SKILL_KEYS, type Skill } from "@/lib/taxonomy";

export type HelperRow = {
  skills: Skill[];
  radius_km: number;
  lat: number;
  lng: number;
  available: boolean;
  bio: string | null;
};

export function HelperForm({ userId, helper }: { userId: string; helper: HelperRow | null }) {
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
          setError("Set your base location so we know which problems are near you.");
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
        <h2 className="font-bold">Be a helper</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Get alerted only when a problem near you needs your skill. Your exact location is never shown, only the
          distance.
        </p>
      </div>

      <fieldset>
        <legend className="label">Skills</legend>
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
                {SKILLS[k]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <span className="label">Base location</span>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() =>
            currentPosition()
              .then((p) => setBase({ lat: p.lat, lng: p.lng }))
              .catch((e: Error) => setError(e.message))
          }
        >
          <LocateFixed className="size-4" /> {base ? "Location set. Update to here" : "Use my current location"}
        </button>
      </div>

      <div>
        <label className="label" htmlFor="radius">How far will you go? {radius} km</label>
        <input id="radius" type="range" min={1} max={20} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
      </div>

      <div>
        <label className="label" htmlFor="bio">About you (optional)</label>
        <input id="bio" className="input" maxLength={280} placeholder="e.g. Free on weekends, good at organizing" value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        Available for alerts right now
      </label>

      <button className="btn-primary w-full" disabled={!!busy || skills.length === 0}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {saved ? "Saved" : helper ? "Update" : "Register as helper"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
