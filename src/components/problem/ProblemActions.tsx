"use client";

import { CheckCircle2, Hand, Heart, Loader2, MapPin, SearchX, Undo2, Wrench, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PhotoInput } from "@/components/PhotoInput";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { currentPosition, GeoError, geoMessage } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { isOpen, PATH_KEYS, RULES, type ProblemPath } from "@/lib/taxonomy";
import type { Problem } from "@/lib/types";
import { uploadPhoto } from "@/lib/upload";
import { useAction } from "./useAction";

type Props = {
  problem: Problem;
  userId: string | null;
  supported: boolean;
  myConfirmations: string[];
};

type OnSiteKind = "exists" | "not_exists" | "fixed" | "not_fixed";

export function ProblemActions({ problem: p, userId, supported, myConfirmations }: Props) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const { busy, error, run, setError } = useAction();
  const [spotPhoto, setSpotPhoto] = useState<Blob | null>(null);

  if (!userId) {
    return (
      <div className="card p-5">
        <p className="font-semibold">{t.actions.canYouHelp}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.actions.signInToHelp}</p>
        <Link href={`/login?next=/problems/${p.id}`} className="btn-primary mt-4 w-full">
          {t.actions.signInButton}
        </Link>
      </div>
    );
  }

  const isOwner = p.owner_id === userId;
  const isReporter = p.reporter_id === userId;
  const open = isOpen(p.status);

  async function onSite(kind: OnSiteKind, photo?: Blob | null, note?: string) {
    // "It's there" and "it's fixed" need proof taken now; the server checks the upload time.
    if ((kind === "exists" || kind === "fixed") && !photo) {
      setError(t.actions.confirmNeedsPhoto);
      return false;
    }
    const ok = await run(kind, async () => {
      let here;
      try {
        here = await currentPosition();
      } catch (e) {
        throw new Error(geoMessage(e instanceof GeoError ? e : null, t));
      }
      const photoUrl = photo ? await uploadPhoto(supabase, userId!, photo) : null;
      const { error } = await supabase.rpc("confirm_problem", {
        p_problem: p.id,
        p_kind: kind,
        p_lat: here.lat,
        p_lng: here.lng,
        p_photo: photoUrl,
        p_note: note || null,
      });
      if (error) throw error;
    });
    if (ok) setSpotPhoto(null);
    return ok;
  }

  async function toggleSupport() {
    return run("support", async () => {
      const { error } = supported
        ? await supabase.from("supports").delete().eq("problem_id", p.id).eq("user_id", userId!)
        : await supabase.from("supports").insert({ problem_id: p.id });
      if (error) throw error;
    });
  }

  return (
    <div className="space-y-4">
      {/* Confirm it's real */}
      {open && !isReporter && (
        <div className="card p-5">
          <p className="font-semibold">{t.actions.atTheSpot}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {fmt(t.actions.onlyWithin, { n: RULES.maxDistanceM })}{" "}
            {p.status === "reported" && fmt(t.actions.moreNeeded, { n: Math.max(0, RULES.confirmThreshold - p.confirm_count) })}
          </p>
          <PhotoInput photo={spotPhoto} onChange={setSpotPhoto} label={t.photo.takeFresh} fresh />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onSite("exists", spotPhoto)}
              disabled={!!busy}
              className={myConfirmations.includes("exists") ? "btn-primary" : "btn-secondary"}
            >
              {busy === "exists" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {t.actions.seeItToo}
            </button>
            <button
              onClick={() => onSite("not_exists")}
              disabled={!!busy}
              className={myConfirmations.includes("not_exists") ? "btn-primary" : "btn-secondary"}
            >
              {busy === "not_exists" ? <Loader2 className="size-4 animate-spin" /> : <SearchX className="size-4" />}
              {t.actions.cantFind}
            </button>
          </div>
          <OnSiteHint />
        </div>
      )}

      {/* Verify a fix */}
      {p.status === "resolved" && !isOwner && <VerifyFix busy={busy} onVerify={onSite} mine={myConfirmations} />}
      {p.status === "resolved" && isOwner && (
        <div className="card p-5 text-sm">
          <p className="font-semibold">{t.actions.waitingVerify}</p>
          <p className="mt-1 text-ink-soft">{fmt(t.actions.verificationsSoFar, { n: p.fixed_count, total: RULES.verifyThreshold })}</p>
        </div>
      )}

      {/* Support */}
      {open && (
        <button onClick={toggleSupport} disabled={!!busy} className={`${supported ? "btn-primary" : "btn-secondary"} w-full`}>
          {busy === "support" ? <Loader2 className="size-4 animate-spin" /> : <Heart className={`size-4 ${supported ? "fill-current" : ""}`} />}
          {supported ? t.actions.supported : t.actions.affectsMe} · {p.support_count}
        </button>
      )}

      {/* Ownership */}
      {open && !p.owner_id && <ClaimBox problem={p} busy={busy} run={run} />}
      {open && isOwner && <OwnerBox problem={p} userId={userId} busy={busy} run={run} />}
      {open && !isOwner && !p.owner_id && p.path !== "danger" && (
        <ResolveBox problem={p} userId={userId} busy={busy} run={run} title={t.actions.alreadyFixed} />
      )}

      {(isReporter || isOwner) && open && <ChangePath problem={p} busy={busy} run={run} />}

      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

type Run = ReturnType<typeof useAction>["run"];

function ClaimBox({ problem: p, busy, run }: { problem: Problem; busy: string | null; run: Run }) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const danger = p.path === "danger";

  return (
    <div className="card p-5">
      <p className="font-semibold">{danger ? t.actions.coordinate : t.actions.takeOwnership}</p>
      <p className="mt-1 text-sm text-ink-soft">{danger ? t.actions.coordinateHelp : t.actions.ownershipHelp}</p>
      <textarea
        className="input mt-3 min-h-16"
        maxLength={300}
        placeholder={danger ? t.actions.dangerPlanPlaceholder : t.actions.planPlaceholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t.actions.deadline}>
          {[1, 3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              {fmt(t.actions.withinDays, { n: d })}
            </option>
          ))}
        </select>
        <button
          className="btn-primary flex-1"
          disabled={!!busy}
          onClick={() =>
            run("claim", async () => {
              const { error } = await supabase.rpc("claim_problem", { p_problem: p.id, p_days: days, p_note: note || null });
              if (error) throw error;
            })
          }
        >
          {busy === "claim" ? <Loader2 className="size-4 animate-spin" /> : <Hand className="size-4" />}
          {t.actions.takeItOn}
        </button>
      </div>
    </div>
  );
}

function OwnerBox({ problem: p, userId, busy, run }: { problem: Problem; userId: string; busy: string | null; run: Run }) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  return (
    <div className="space-y-4">
      <ResolveBox problem={p} userId={userId} busy={busy} run={run} title={t.actions.doneAfter} />
      <button
        className="btn-secondary w-full"
        disabled={!!busy}
        onClick={() =>
          run("release", async () => {
            const { error } = await supabase.rpc("release_problem", { p_problem: p.id, p_note: null });
            if (error) throw error;
          })
        }
      >
        {busy === "release" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
        {t.actions.release}
      </button>
    </div>
  );
}

function ResolveBox({
  problem: p,
  userId,
  busy,
  run,
  title,
}: {
  problem: Problem;
  userId: string;
  busy: string | null;
  run: Run;
  title: string;
}) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="card p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{fmt(t.actions.sameAngle, { n: RULES.verifyThreshold })}</p>
      <PhotoInput photo={photo} onChange={setPhoto} label={t.actions.afterPhoto} />
      <textarea
        className="input mt-3 min-h-16"
        maxLength={500}
        placeholder={t.actions.whatWasDone}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="btn-primary mt-3 w-full"
        disabled={!photo || !!busy}
        onClick={() =>
          run("resolve", async () => {
            const url = await uploadPhoto(supabase, userId, photo!);
            const { error } = await supabase.rpc("resolve_problem", { p_problem: p.id, p_photo: url, p_note: note || null });
            if (error) throw error;
          })
        }
      >
        {busy === "resolve" ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
        {t.actions.markFixed}
      </button>
    </div>
  );
}

function VerifyFix({
  busy,
  onVerify,
  mine,
}: {
  busy: string | null;
  onVerify: (kind: "fixed" | "not_fixed", photo?: Blob | null, note?: string) => Promise<boolean>;
  mine: string[];
}) {
  const { t } = useI18n();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="card border-brand/50 p-5">
      <p className="font-semibold">{t.actions.reallyFixed}</p>
      <p className="mt-1 text-sm text-ink-soft">{t.actions.verifyHelp}</p>
      <PhotoInput photo={photo} onChange={setPhoto} label={t.photo.takeFresh} fresh />
      <input className="input mt-3" maxLength={280} placeholder={t.actions.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className={mine.includes("fixed") ? "btn-primary" : "btn-secondary"}
          disabled={!!busy}
          onClick={async () => {
            if (await onVerify("fixed", photo, note)) setPhoto(null);
          }}
        >
          {busy === "fixed" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {t.actions.yesFixed}
        </button>
        <button
          className={mine.includes("not_fixed") ? "btn-danger" : "btn-secondary"}
          disabled={!!busy}
          onClick={() => onVerify("not_fixed", photo, note)}
        >
          {busy === "not_fixed" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
          {t.actions.notFixed}
        </button>
      </div>
      <OnSiteHint />
    </div>
  );
}

function ChangePath({ problem: p, busy, run }: { problem: Problem; busy: string | null; run: Run }) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<ProblemPath>(p.path);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button className="w-full text-sm text-ink-soft underline" onClick={() => setOpen(true)}>
        {t.actions.stuck}
      </button>
    );
  }
  return (
    <div className="card p-5">
      <p className="font-semibold">{t.actions.switchPath}</p>
      <select className="input mt-3" value={path} onChange={(e) => setPath(e.target.value as ProblemPath)}>
        {PATH_KEYS.map((k) => (
          <option key={k} value={k}>
            {t.taxonomy.paths[k].label}
          </option>
        ))}
      </select>
      <input className="input mt-2" maxLength={300} placeholder={t.actions.whySwitch} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
        <button
          className="btn-primary flex-1"
          disabled={!!busy || path === p.path || !reason.trim()}
          onClick={async () => {
            const ok = await run("path", async () => {
              const { error } = await supabase.rpc("change_path", { p_problem: p.id, p_path: path, p_reason: reason });
              if (error) throw error;
            });
            if (ok) setOpen(false);
          }}
        >
          {t.actions.switchPath}
        </button>
      </div>
    </div>
  );
}

function OnSiteHint() {
  const { t } = useI18n();
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-ink-soft">
      <MapPin className="size-3" /> {t.actions.usesLocation}
    </p>
  );
}
