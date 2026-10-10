"use client";

import { Camera, Loader2, LocateFixed, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { LocationPicker } from "@/components/map";
import { StatusBadge } from "@/components/Badges";
import { currentPosition, DEFAULT_CENTER, formatDistance, type LatLng } from "@/lib/geo";
import { blobToBase64, compressImage } from "@/lib/image";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  PATHS,
  PATH_KEYS,
  SEVERITIES,
  SEVERITY_KEYS,
  SKILLS,
  SKILL_KEYS,
  type Category,
  type ProblemPath,
  type ProblemStatus,
  type Severity,
  type Skill,
} from "@/lib/taxonomy";
import type { Triage } from "@/lib/types";
import { uploadPhoto } from "@/lib/upload";

const MAX_PHOTOS = 3;

type Photo = { id: string; blob: Blob; preview: string };
type Nearby = { id: string; title: string; status: ProblemStatus; distance_m: number; photo: string | null };

export function ReportForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useState(createClient)[0];

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locState, setLocState] = useState<"locating" | "ok" | "manual">("locating");
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [address, setAddress] = useState("");

  const [triage, setTriage] = useState<Triage | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [path, setPath] = useState<ProblemPath>("neighbours");
  const [skills, setSkills] = useState<Skill[]>([]);

  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State is only set once the position arrives, so this is safe to start from an effect.
  const requestLocation = useCallback(() => {
    currentPosition()
      .then((p) => {
        setLocation({ lat: p.lat, lng: p.lng });
        setLocState("ok");
        setLocMessage(
          p.accuracy > 100
            ? `Location is approximate (±${Math.round(p.accuracy)} m). Drag the pin to the exact spot.`
            : null,
        );
      })
      .catch((e: Error) => {
        setLocation((l) => l ?? DEFAULT_CENTER);
        setLocState("manual");
        setLocMessage(`${e.message} Drag the pin to the right spot.`);
      });
  }, []);

  useEffect(requestLocation, [requestLocation]);

  function locate() {
    setLocState("locating");
    setLocMessage(null);
    requestLocation();
  }

  // Free preview URLs when the form goes away (removed photos are freed in removePhoto).
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function removePhoto(id: string) {
    setPhotos((all) => {
      const gone = all.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return all.filter((x) => x.id !== id);
    });
  }

  // Already reported nearby?
  useEffect(() => {
    if (!location) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("nearby_problems", { p_lat: location.lat, p_lng: location.lng, p_radius_m: 150 });
      setNearby((data as Nearby[] | null) ?? []);
    }, 400);
    return () => clearTimeout(t);
  }, [location, supabase]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        const blob = await compressImage(file);
        added.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      }
      setPhotos((p) => [...p, ...added]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function applyTriage(t: Triage) {
    setTriage(t);
    setTitle(t.title);
    setCategory(t.category);
    setSeverity(t.severity);
    setPath(t.path);
    setSkills(t.skills_needed);
  }

  async function runTriage() {
    setTriaging(true);
    setError(null);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          image: photos[0] ? { base64: await blobToBase64(photos[0].blob), mediaType: "image/jpeg" } : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not analyse the report");
      applyTriage(body as Triage);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setTriaging(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!location) return;
    setSubmitting(true);
    setError(null);
    try {
      const urls = await Promise.all(photos.map((p) => uploadPhoto(supabase, userId, p.blob)));
      const { data, error } = await supabase
        .from("problems")
        .insert({
          title: title.trim(),
          description: description.trim(),
          category,
          severity,
          path,
          lat: location.lat,
          lng: location.lng,
          address: address.trim() || null,
          photos: urls,
          skills_needed: skills,
          ai_triage: triage,
        })
        .select("id")
        .single();
      if (error) throw error;
      router.push(`/problems/${data.id}?new=1`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  const canTriage = (photos.length > 0 || description.trim().length > 5) && !triaging;
  const canSubmit = !!location && title.trim().length >= 4 && (photos.length > 0 || description.trim().length > 10) && !submitting;

  return (
    <form onSubmit={submit} className="mt-8 space-y-8">
      {/* 1. Photo */}
      <section>
        <h2 className="font-semibold">1. Photo</h2>
        <p className="text-sm text-ink-soft">Up to {MAX_PHOTOS}. Show the problem and something recognisable nearby.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative size-28 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={p.preview} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="grid size-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-soft hover:border-brand hover:text-brand">
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <Camera className="size-6" /> Add photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </section>

      {/* 2. Location */}
      <section>
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">2. Where is it?</h2>
            <p className="text-sm text-ink-soft">Tap the map or drag the pin to the exact spot.</p>
          </div>
          <button type="button" onClick={locate} className="btn-secondary">
            <LocateFixed className="size-4" /> Use my location
          </button>
        </div>
        <div className="mt-3">
          {location ? (
            <LocationPicker value={location} onChange={setLocation} />
          ) : (
            <div className="grid h-64 place-items-center rounded-xl bg-surface-2 text-sm text-ink-soft">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Finding you…
              </span>
            </div>
          )}
        </div>
        {locMessage && <p className="mt-2 text-sm text-ink-soft">{locMessage}</p>}
        <input
          className="input mt-3"
          maxLength={200}
          placeholder="Landmark (optional), e.g. Opposite Ganesh temple, 5th Cross"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        {nearby.length > 0 && (
          <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
            <p className="text-sm font-semibold">Already reported nearby? Support it instead of reporting again.</p>
            <ul className="mt-2 space-y-1.5">
              {nearby.map((n) => (
                <li key={n.id}>
                  <Link href={`/problems/${n.id}`} className="flex items-center gap-2 text-sm hover:underline">
                    <StatusBadge status={n.status} />
                    <span className="min-w-0 flex-1 truncate">{n.title}</span>
                    <span className="shrink-0 text-ink-soft">{formatDistance(n.distance_m)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 3. Description */}
      <section>
        <h2 className="font-semibold">3. What&apos;s wrong?</h2>
        <textarea
          className="input mt-3 min-h-28"
          maxLength={2000}
          placeholder="What is it, how long has it been like this, who does it affect?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="button" onClick={runTriage} disabled={!canTriage} className="btn-secondary mt-3">
          {triaging ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {triage ? "Analyse again" : "Suggest how to deal with it"}
        </button>
      </section>

      {/* 4. Path */}
      {(triage || title) && path === "danger" && <EmergencyBanner notes={triage?.safety_notes} />}

      <section className={triage ? "" : "opacity-90"}>
        <h2 className="font-semibold">4. How should it be dealt with?</h2>
        {triage ? (
          <div className="mt-3 rounded-xl bg-brand-soft p-4 text-sm">
            <p className="font-semibold text-brand">
              {triage.source === "ai" ? "Suggested by AI" : "Suggested"}: {PATHS[triage.path].label}
            </p>
            <p className="mt-1">{triage.path_reason}</p>
            {triage.first_steps.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {triage.first_steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            {!triage.is_civic_problem && (
              <p className="mt-2 font-semibold text-danger">
                This may not be a public problem. Sambhal is for shared spaces, not private disputes.
              </p>
            )}
            {triage.path !== "danger" && triage.safety_notes.length > 0 && (
              <p className="mt-2 text-ink-soft">Safety: {triage.safety_notes.join(" ")}</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Tap &ldquo;Suggest&rdquo; above, or choose yourself.</p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PATH_KEYS.map((k) => (
            <label
              key={k}
              className={`card flex cursor-pointer gap-3 p-3 transition ${path === k ? "border-ink ring-1 ring-ink" : "hover:border-ink-soft"}`}
            >
              <input type="radio" name="path" value={k} checked={path === k} onChange={() => setPath(k)} className="sr-only" />
              <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: PATHS[k].color }} />
              <span>
                <span className="block text-sm font-semibold">{PATHS[k].label}</span>
                <span className="block text-xs text-ink-soft">{PATHS[k].blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* 5. Details */}
      <section className="space-y-4">
        <h2 className="font-semibold">5. Details</h2>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input
            id="title"
            className="input"
            required
            minLength={4}
            maxLength={120}
            placeholder="e.g. Garbage dumped at corner of 5th Cross"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>{CATEGORIES[k].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="severity">How urgent?</label>
            <select id="severity" className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
              {SEVERITY_KEYS.map((k) => (
                <option key={k} value={k}>{SEVERITIES[k].label}</option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">Skills needed <span className="font-normal text-ink-soft">(nearby helpers get alerted)</span></legend>
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
      </section>

      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3 text-base">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitting ? "Posting…" : "Post report"}
      </button>
      {locState === "locating" && <p className="text-center text-xs text-ink-soft">Waiting for your location…</p>}
    </form>
  );
}
