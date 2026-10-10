"use client";

import { Camera, CheckCircle2, Hand, Heart, Loader2, MapPin, SearchX, Undo2, Wrench, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { currentPosition } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { PATHS, PATH_KEYS, RULES, type ProblemPath } from "@/lib/taxonomy";
import type { Problem } from "@/lib/types";
import { uploadPhoto } from "@/lib/upload";
import { useAction } from "./useAction";

type Props = {
  problem: Problem;
  userId: string | null;
  supported: boolean;
  myConfirmations: string[];
};

const OPEN = ["reported", "confirmed", "claimed", "reopened"];

export function ProblemActions({ problem: p, userId, supported, myConfirmations }: Props) {
  const supabase = useState(createClient)[0];
  const { busy, error, run } = useAction();

  if (!userId) {
    return (
      <div className="card p-5">
        <p className="font-semibold">Can you help with this?</p>
        <p className="mt-1 text-sm text-ink-soft">Sign in to confirm it, support it, or take it on.</p>
        <Link href={`/login?next=/problems/${p.id}`} className="btn-primary mt-4 w-full">
          Sign in to help
        </Link>
      </div>
    );
  }

  const isOwner = p.owner_id === userId;
  const isReporter = p.reporter_id === userId;
  const isOpen = OPEN.includes(p.status);

  async function onSite(kind: "exists" | "not_exists" | "fixed" | "not_fixed", photo?: File | null, note?: string) {
    return run(kind, async () => {
      const here = await currentPosition();
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
      {isOpen && !isReporter && (
        <div className="card p-5">
          <p className="font-semibold">Are you at the spot?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Confirmations only count from within {RULES.maxDistanceM} m. {p.status === "reported" && `${Math.max(0, RULES.confirmThreshold - p.confirm_count)} more needed.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onSite("exists")}
              disabled={!!busy}
              className={myConfirmations.includes("exists") ? "btn-primary" : "btn-secondary"}
            >
              {busy === "exists" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              I see it too
            </button>
            <button
              onClick={() => onSite("not_exists")}
              disabled={!!busy}
              className={myConfirmations.includes("not_exists") ? "btn-primary" : "btn-secondary"}
            >
              {busy === "not_exists" ? <Loader2 className="size-4 animate-spin" /> : <SearchX className="size-4" />}
              Can&apos;t find it
            </button>
          </div>
          <div className="mt-2">
            <OnSiteHint />
          </div>
        </div>
      )}

      {/* Verify a fix */}
      {p.status === "resolved" && !isOwner && <VerifyFix busy={busy} onVerify={onSite} mine={myConfirmations} />}
      {p.status === "resolved" && isOwner && (
        <div className="card p-5 text-sm">
          <p className="font-semibold">Waiting for peers to verify</p>
          <p className="mt-1 text-ink-soft">
            {p.fixed_count} of {RULES.verifyThreshold} verifications so far. Share the link with people nearby.
          </p>
        </div>
      )}

      {/* Support */}
      {isOpen && (
        <button onClick={toggleSupport} disabled={!!busy} className={`${supported ? "btn-primary" : "btn-secondary"} w-full`}>
          {busy === "support" ? <Loader2 className="size-4 animate-spin" /> : <Heart className={`size-4 ${supported ? "fill-current" : ""}`} />}
          {supported ? "You support this" : "This affects me too"} · {p.support_count}
        </button>
      )}

      {/* Ownership */}
      {isOpen && !p.owner_id && <ClaimBox problem={p} busy={busy} run={run} />}
      {isOpen && isOwner && <OwnerBox problem={p} userId={userId} busy={busy} run={run} />}
      {isOpen && !isOwner && !p.owner_id && p.path !== "danger" && (
        <ResolveBox problem={p} userId={userId} busy={busy} run={run} title="Already fixed it? Post the after photo" />
      )}

      {(isReporter || isOwner) && isOpen && <ChangePath problem={p} busy={busy} run={run} />}

      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

type Run = ReturnType<typeof useAction>["run"];

function ClaimBox({ problem: p, busy, run }: { problem: Problem; busy: string | null; run: Run }) {
  const supabase = useState(createClient)[0];
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const danger = p.path === "danger";

  return (
    <div className="card p-5">
      <p className="font-semibold">{danger ? "Coordinate the response" : "Take ownership"}</p>
      <p className="mt-1 text-sm text-ink-soft">
        {danger
          ? "You make sure emergency services are called and people are warned. You don't fix it yourself."
          : "You don't have to do it alone. Owning it means you keep it moving and post updates. If you go quiet for a week, it opens up again."}
      </p>
      <textarea
        className="input mt-3 min-h-16"
        maxLength={300}
        placeholder={danger ? "e.g. Called 112, putting up a warning sign" : "Your plan, e.g. Cleanup drive Sunday 8am, bring gloves"}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Deadline">
          {[1, 3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              within {d} day{d > 1 ? "s" : ""}
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
          I&apos;ll take this on
        </button>
      </div>
    </div>
  );
}

function OwnerBox({ problem: p, userId, busy, run }: { problem: Problem; userId: string; busy: string | null; run: Run }) {
  const supabase = useState(createClient)[0];
  return (
    <div className="space-y-4">
      <ResolveBox problem={p} userId={userId} busy={busy} run={run} title="Done? Post the after photo" />
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
        I can&apos;t do this anymore, let someone else take it
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
  const supabase = useState(createClient)[0];
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="card p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">
        Take it from the same angle as the original. {RULES.verifyThreshold} peers then check it on the spot.
      </p>
      <PhotoInput file={photo} onChange={setPhoto} label="After photo (required)" />
      <textarea
        className="input mt-3 min-h-16"
        maxLength={500}
        placeholder="What was done, and by whom? Thank the people who helped."
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
        Mark as fixed
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
  onVerify: (kind: "fixed" | "not_fixed", photo?: File | null, note?: string) => Promise<boolean>;
  mine: string[];
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="card border-brand/50 p-5">
      <p className="font-semibold">Is it really fixed? Check on the spot.</p>
      <p className="mt-1 text-sm text-ink-soft">Your location is checked. A photo makes your verification stronger.</p>
      <PhotoInput file={photo} onChange={setPhoto} label="Photo (optional)" />
      <input className="input mt-3" maxLength={280} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className={mine.includes("fixed") ? "btn-primary" : "btn-secondary"}
          disabled={!!busy}
          onClick={() => onVerify("fixed", photo, note)}
        >
          {busy === "fixed" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Yes, fixed
        </button>
        <button
          className={mine.includes("not_fixed") ? "btn-danger" : "btn-secondary"}
          disabled={!!busy}
          onClick={() => onVerify("not_fixed", photo, note)}
        >
          {busy === "not_fixed" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
          Not fixed
        </button>
      </div>
    </div>
  );
}

function ChangePath({ problem: p, busy, run }: { problem: Problem; busy: string | null; run: Run }) {
  const supabase = useState(createClient)[0];
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<ProblemPath>(p.path);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button className="w-full text-sm text-ink-soft underline" onClick={() => setOpen(true)}>
        Stuck? Try a different path
      </button>
    );
  }
  return (
    <div className="card p-5">
      <p className="font-semibold">Switch path</p>
      <select className="input mt-3" value={path} onChange={(e) => setPath(e.target.value as ProblemPath)}>
        {PATH_KEYS.map((k) => (
          <option key={k} value={k}>{PATHS[k].label}</option>
        ))}
      </select>
      <input
        className="input mt-2"
        maxLength={300}
        placeholder="Why? e.g. Nobody has the right tools, so let's pool money for a plumber"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
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
          Switch path
        </button>
      </div>
    </div>
  );
}

export function PhotoInput({ file, onChange, label }: { file: File | null; onChange: (f: File | null) => void; label: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="mt-3">
      {file && preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={preview} alt="" className="max-h-40 rounded-xl" />
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(preview);
              setPreview(null);
              onChange(null);
            }}
            className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
            aria-label="Remove photo"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <label className="btn-secondary w-fit cursor-pointer">
          <Camera className="size-4" /> {label}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f) setPreview(URL.createObjectURL(f));
              onChange(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function OnSiteHint() {
  return (
    <p className="flex items-center gap-1 text-xs text-ink-soft">
      <MapPin className="size-3" /> Uses your location once, only to check you&apos;re nearby.
    </p>
  );
}
