"use client";

import { Flag, Loader2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { FLAG_REASONS, RULES, type FlagReason } from "@/lib/taxonomy";

export function FlagButton({ type, id, compact = false }: { type: "problem" | "update"; id: string; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason>("spam");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const { error } = await createClient().rpc("flag_content", { p_type: type, p_id: id, p_reason: reason, p_note: note || null });
    if (error) {
      setError(errorMessage(error));
      setState("idle");
    } else {
      setState("done");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger ${compact ? "" : "underline"}`}
        aria-label={t.flag.title}
      >
        <Flag className="size-3" /> {!compact && t.flag.button}
      </button>
    );
  }

  if (state === "done") return <p className="text-xs text-ink-soft">{fmt(t.flag.thanks, { n: RULES.autoHideFlags })}</p>;

  return (
    <form onSubmit={submit} className="card mt-2 space-y-2 p-3 text-sm">
      <p className="font-semibold">{t.flag.title}</p>
      <fieldset className="space-y-1">
        <legend className="sr-only">{t.flag.reason}</legend>
        {FLAG_REASONS.map((r) => (
          <label key={r} className="flex items-start gap-2">
            <input type="radio" name={`flag-${id}`} checked={reason === r} onChange={() => setReason(r)} className="mt-1 accent-[var(--brand)]" />
            {t.flag.reasons[r]}
          </label>
        ))}
      </fieldset>
      <input className="input" maxLength={500} placeholder={t.flag.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
        <button className="btn-danger flex-1" disabled={state === "busy"}>
          {state === "busy" && <Loader2 className="size-4 animate-spin" />} {t.flag.submit}
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
