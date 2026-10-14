"use client";

import { Camera, EyeOff, Loader2, LocateFixed, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { StatusBadge } from "@/components/Badges";
import { LocationPicker } from "@/components/map";
import { PhotoEditor } from "@/components/PhotoEditor";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { errorMessage } from "@/lib/format";
import { currentPosition, DEFAULT_CENTER, formatDistance, geoMessage, reverseGeocode, type LatLng } from "@/lib/geo";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORY_KEYS,
  PATHS,
  PATH_KEYS,
  SEVERITY_KEYS,
  SKILL_KEYS,
  type Category,
  type ProblemPath,
  type ProblemStatus,
  type Severity,
  type Skill,
} from "@/lib/taxonomy";
import { triage } from "@/lib/triage";
import { uploadPhoto } from "@/lib/upload";

const MAX_PHOTOS = 3;

type Photo = { id: string; blob: Blob; preview: string };
type Nearby = { id: string; title: string; status: ProblemStatus; distance_m: number; photo: string | null };

export function ReportForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = useState(createClient)[0];

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [editQueue, setEditQueue] = useState<Photo[]>([]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locState, setLocState] = useState<"locating" | "ok" | "manual">("locating");
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const localityTouched = useRef(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [path, setPath] = useState<ProblemPath>("neighbours");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [applied, setApplied] = useState(false);

  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instant, free suggestion from keyword rules as the resident types.
  const deferredDescription = useDeferredValue(description);
  const suggestion = useMemo(
    () => (deferredDescription.trim().length > 5 ? triage(deferredDescription) : null),
    [deferredDescription],
  );

  const requestLocation = useCallback(() => {
    currentPosition()
      .then((p) => {
        setLocation({ lat: p.lat, lng: p.lng });
        setLocState("ok");
        setLocMessage(p.accuracy > 100 ? fmt(t.report.approximate, { n: Math.round(p.accuracy) }) : null);
      })
      .catch((e) => {
        setLocation((l) => l ?? DEFAULT_CENTER);
        setLocState("manual");
        setLocMessage(`${geoMessage(e, t)} ${t.report.dragPin}`);
      });
  }, [t]);

  useEffect(requestLocation, [requestLocation]);

  function locate() {
    setLocState("locating");
    setLocMessage(null);
    requestLocation();
  }

  // Free preview URLs when the form goes away.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  // Already reported nearby? Plus the neighbourhood name, from OpenStreetMap.
  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const [{ data }, place] = await Promise.all([
        supabase.rpc("nearby_problems", { p_lat: location.lat, p_lng: location.lng, p_radius_m: 150 }),
        reverseGeocode(location, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setNearby((data as Nearby[] | null) ?? []);
      if (!localityTouched.current) {
        setLocality(place.locality ?? "");
        setCity(place.city ?? "");
      }
    }, 700); // also keeps us within Nominatim's 1 request/second policy while the pin is dragged
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [location, supabase]);

  function removePhoto(id: string) {
    setPhotos((all) => {
      const gone = all.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return all.filter((x) => x.id !== id);
    });
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        const blob = await compressImage(file);
        added.push({ id: crypto.randomUUID(), blob, preview: "" });
      }
      // Each new photo goes through the privacy editor before it's added.
      setEditQueue((q) => [...q, ...added]);
    } catch {
      setError(t.photo.process);
    }
  }

  function finishEdit(edited: Blob | null) {
    const [current, ...rest] = editQueue;
    setEditQueue(rest);
    if (!current || !edited) return;
    setPhotos((all) => {
      const existing = all.find((p) => p.id === current.id);
      const next = { id: current.id, blob: edited, preview: URL.createObjectURL(edited) };
      if (existing) {
        URL.revokeObjectURL(existing.preview);
        return all.map((p) => (p.id === current.id ? next : p));
      }
      return [...all, next].slice(0, MAX_PHOTOS);
    });
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (suggestion.title.length >= 4 && !title.trim()) setTitle(suggestion.title);
    setCategory(suggestion.category);
    setSeverity(suggestion.severity);
    setPath(suggestion.path);
    setSkills(suggestion.skills_needed);
    setApplied(true);
  }

  // Until the resident picks things themselves, follow the suggestion.
  useEffect(() => {
    if (!suggestion || applied) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived defaults, overridden once the user chooses
    setCategory(suggestion.category);
    setSeverity(suggestion.severity);
    setPath(suggestion.path);
    setSkills(suggestion.skills_needed);
  }, [suggestion, applied]);

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
          locality: locality.trim() || null,
          city: city.trim() || null,
          photos: urls,
          skills_needed: skills,
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

  const choose = <T,>(set: (v: T) => void) => (v: T) => {
    setApplied(true);
    set(v);
  };

  const canSubmit = !!location && title.trim().length >= 4 && (photos.length > 0 || description.trim().length > 10) && !submitting;

  return (
    <form onSubmit={submit} className="mt-8 space-y-8">
      {/* 1. Photo */}
      <section>
        <h2 className="font-semibold">{t.report.photoStep}</h2>
        <p className="text-sm text-ink-soft">{fmt(t.report.photoHelp, { n: MAX_PHOTOS })}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative size-28 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={p.preview} alt="" className="size-full object-cover" />
              <div className="absolute top-1 right-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditQueue((q) => [...q, p])}
                  className="grid size-6 place-items-center rounded-full bg-black/60 text-white"
                  aria-label={t.photo.edit}
                >
                  <EyeOff className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  className="grid size-6 place-items-center rounded-full bg-black/60 text-white"
                  aria-label={t.common.removePhoto}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="grid size-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-soft hover:border-brand hover:text-brand">
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <Camera className="size-6" /> {t.photo.add}
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
            <h2 className="font-semibold">{t.report.whereStep}</h2>
            <p className="text-sm text-ink-soft">{t.report.whereHelp}</p>
          </div>
          <button type="button" onClick={locate} className="btn-secondary">
            <LocateFixed className="size-4" /> {t.report.useMyLocation}
          </button>
        </div>
        <div className="mt-3">
          {location ? (
            <LocationPicker value={location} onChange={setLocation} />
          ) : (
            <div className="grid h-64 place-items-center rounded-xl bg-surface-2 text-sm text-ink-soft">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {t.report.findingYou}
              </span>
            </div>
          )}
        </div>
        {locMessage && <p className="mt-2 text-sm text-ink-soft">{locMessage}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="locality">{t.report.locality}</label>
            <input
              id="locality"
              className="input"
              maxLength={80}
              placeholder={t.report.localityPlaceholder}
              value={locality}
              onChange={(e) => {
                localityTouched.current = true;
                setLocality(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="city">{t.report.city}</label>
            <input
              id="city"
              className="input"
              maxLength={80}
              value={city}
              onChange={(e) => {
                localityTouched.current = true;
                setCity(e.target.value);
              }}
            />
          </div>
        </div>
        <input className="input mt-3" maxLength={200} placeholder={t.report.landmark} value={address} onChange={(e) => setAddress(e.target.value)} />
        {nearby.length > 0 && (
          <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
            <p className="text-sm font-semibold">{t.report.alreadyReported}</p>
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
        <h2 className="font-semibold">{t.report.whatStep}</h2>
        <textarea
          className="input mt-3 min-h-28"
          maxLength={2000}
          placeholder={t.report.whatPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </section>

      {/* 4. Path */}
      {path === "danger" && <EmergencyBanner notes={t.guidance.safety.danger ? [t.guidance.safety.danger] : []} />}

      <section>
        <h2 className="font-semibold">{t.report.pathStep}</h2>
        {suggestion ? (
          <div className="mt-3 rounded-xl bg-brand-soft p-4 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-brand">
              <Sparkles className="size-4" /> {t.guidance.suggested}: {t.taxonomy.paths[suggestion.path].label} ·{" "}
              {t.taxonomy.categories[suggestion.category]}
            </p>
            <p className="mt-1">{t.taxonomy.paths[suggestion.path].blurb}</p>
            {t.guidance.tips[suggestion.category] && <p className="mt-1 text-ink-soft">{t.guidance.tips[suggestion.category]}</p>}
            {!suggestion.is_civic_problem && <p className="mt-2 font-semibold text-danger">{t.guidance.notCivic}</p>}
            {applied && (
              <button type="button" onClick={applySuggestion} className="btn-secondary mt-3 px-4 py-1.5 text-xs">
                {t.report.applySuggestion}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">{t.report.pickYourself}</p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {PATH_KEYS.map((k) => (
            <label
              key={k}
              className={`card flex cursor-pointer gap-3 p-3 transition ${path === k ? "border-ink ring-1 ring-ink" : "hover:border-ink-soft"}`}
            >
              <input type="radio" name="path" value={k} checked={path === k} onChange={() => choose(setPath)(k)} className="sr-only" />
              <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: PATHS[k].color }} />
              <span>
                <span className="block text-sm font-semibold">{t.taxonomy.paths[k].label}</span>
                <span className="block text-xs text-ink-soft">{t.taxonomy.paths[k].blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* 5. Details */}
      <section className="space-y-4">
        <h2 className="font-semibold">{t.report.detailsStep}</h2>
        <div>
          <label className="label" htmlFor="title">{t.report.titleLabel}</label>
          <input
            id="title"
            className="input"
            required
            minLength={4}
            maxLength={120}
            placeholder={suggestion?.title || t.report.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => {
              if (!title && suggestion && suggestion.title.length >= 4) setTitle(suggestion.title);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">{t.report.category}</label>
            <select id="category" className="input" value={category} onChange={(e) => choose(setCategory)(e.target.value as Category)}>
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t.taxonomy.categories[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="severity">{t.report.urgency}</label>
            <select id="severity" className="input" value={severity} onChange={(e) => choose(setSeverity)(e.target.value as Severity)}>
              {SEVERITY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t.taxonomy.severities[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">
            {t.report.skillsNeeded} <span className="font-normal text-ink-soft">{t.report.skillsHint}</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_KEYS.map((k) => {
              const on = skills.includes(k);
              return (
                <button
                  type="button"
                  key={k}
                  aria-pressed={on}
                  onClick={() => choose(setSkills)(on ? skills.filter((x) => x !== k) : [...skills, k])}
                  className={`chip border py-1 ${on ? "border-brand bg-brand text-brand-ink" : "border-line text-ink-soft"}`}
                >
                  {t.taxonomy.skills[k]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3 text-base">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitting ? t.report.posting : t.report.post}
      </button>
      {locState === "locating" && <p className="text-center text-xs text-ink-soft">{t.report.waitingLocation}</p>}

      {editQueue[0] && <PhotoEditor key={editQueue[0].id} photo={editQueue[0].blob} onCancel={() => finishEdit(null)} onDone={finishEdit} />}
    </form>
  );
}
