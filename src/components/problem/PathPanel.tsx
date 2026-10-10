"use client";

import { Check, Copy, FileText, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { errorMessage } from "@/lib/format";
import { PATHS, SKILLS, type Skill } from "@/lib/taxonomy";
import type { Problem } from "@/lib/types";

export type NearbyHelper = { display_name: string; skills: string[]; distance_km: number; reputation: number };

const GUIDE: Record<Problem["path"], string[]> = {
  danger: [],
  neighbours: [
    "Take ownership and pick a time, ideally a weekend morning.",
    "Share this page on your building or street WhatsApp group to gather volunteers.",
    "List what to bring in a comment: gloves, bags, brooms, paint.",
    "Post the after photo when done so peers can verify.",
  ],
  skill: [
    "Helpers nearby with the right skill have been alerted.",
    "If you know someone skilled, share this page with them.",
    "If nobody can do it for free, switch the path to funding and pool money for a professional.",
  ],
  funding: [
    "In a comment, list what is needed and what each item costs.",
    "Peers and local shops reply with what they will bring or pay. Keep everything visible here.",
    "Never collect money through strangers. Buy materials together, and post the receipts.",
  ],
  owner: [
    "Find out who owns or caused it: a shop, a builder, a housing society.",
    "Use the polite notice below. Deliver it in person or send it, with this link as evidence.",
    "Post their response here. If nothing happens in a week, switch to a collective ask.",
  ],
  collective: [
    "The more peers who support this, the stronger the ask. Share it widely.",
    "Use the collective ask below on social media, with journalists, or at ward committee meetings.",
    "If there is no response in 30 days, file an RTI application asking what action has been taken.",
  ],
};

const DRAFTS: Partial<Record<Problem["path"], { kind: string; label: string }[]>> = {
  owner: [{ kind: "owner_notice", label: "Draft a polite notice" }],
  collective: [
    { kind: "collective_ask", label: "Draft the collective ask" },
    { kind: "rti", label: "Draft an RTI application" },
  ],
  funding: [{ kind: "collective_ask", label: "Draft an appeal" }],
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
  const path = PATHS[problem.path];
  const done = problem.status === "verified" || problem.status === "archived";
  const triage = problem.ai_triage;
  const steps = triage?.path === problem.path && triage.first_steps.length ? triage.first_steps : GUIDE[problem.path];

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line p-5" style={{ borderTop: `4px solid ${path.color}` }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Path</p>
        <h2 className="mt-1 text-lg font-bold">{path.label}</h2>
        <p className="mt-1 text-sm text-ink-soft">{path.blurb}</p>
        {triage?.path === problem.path && triage.path_reason && <p className="mt-2 text-sm">{triage.path_reason}</p>}
      </div>

      {!done && (
        <div className="space-y-4 p-5">
          {problem.path === "danger" ? (
            <EmergencyBanner notes={triage?.safety_notes} />
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}

          {problem.skills_needed.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold">Skills needed:</span>{" "}
              {problem.skills_needed.map((s) => SKILLS[s as Skill] ?? s).join(", ")}
            </p>
          )}

          {helpers && (
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4" /> Helpers nearby ({helpers.length})
              </p>
              {helpers.length === 0 ? (
                <p className="mt-1 text-sm text-ink-soft">
                  No registered helpers nearby yet. Know someone? Share this page with them.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {helpers.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-medium">{h.display_name}</span>
                        <span className="block text-xs text-ink-soft">
                          {h.skills.map((s) => SKILLS[s as Skill] ?? s).join(", ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">{h.distance_km} km</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {signedIn &&
            DRAFTS[problem.path]?.map((d) => <DraftBox key={d.kind} problemId={problem.id} kind={d.kind} label={d.label} />)}
        </div>
      )}
    </section>
  );
}

function DraftBox({ problemId, kind, label }: { problemId: string; kind: string; label: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, kind }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not draft");
      setText(body.text);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!text ? (
        <button className="btn-secondary w-full" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          {label}
        </button>
      ) : (
        <div className="rounded-xl border border-line">
          <textarea
            className="block min-h-56 w-full resize-y rounded-t-xl bg-surface p-3 font-mono text-xs outline-none"
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
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              className="btn-secondary flex-1"
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
            <button className="btn-secondary" onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Redo"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
