"use client";

import { CalendarHeart, CalendarPlus, Check, Loader2, MapPin, Share2, Users, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { formatDate, hoursUntil } from "@/lib/format";
import { downloadFile, driveIcs } from "@/lib/ics";
import { createClient } from "@/lib/supabase/client";
import { isOpen } from "@/lib/taxonomy";
import type { DriveEvent, Problem } from "@/lib/types";
import { useAction } from "./useAction";

/** Default to next Sunday, 8am local time, formatted for <input type="datetime-local">. */
function nextSundayMorning() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(8, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T08:00`;
}

export function EventsPanel({ problem, events, userId }: { problem: Problem; events: DriveEvent[]; userId: string | null }) {
  const { t } = useI18n();
  // Drives stay "upcoming" until a few hours after they start.
  const upcoming = events.filter((e) => e.status === "planned" && hoursUntil(e.starts_at) > -6);
  const past = events.filter((e) => !upcoming.includes(e));
  const canPlan = !!userId && isOpen(problem.status) && problem.path !== "danger";

  if (events.length === 0 && !canPlan) return null;

  return (
    <section className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <CalendarHeart className="size-5 text-brand" /> {t.events.title}
      </h2>
      {upcoming.map((e) => (
        <DriveCard key={e.id} event={e} problem={problem} userId={userId} />
      ))}
      {canPlan && <PlanDrive problemId={problem.id} />}
      {past.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-soft">{t.events.past}</summary>
          <div className="mt-2 space-y-2">
            {past.map((e) => (
              <DriveCard key={e.id} event={e} problem={problem} userId={userId} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function DriveCard({ event: e, problem, userId }: { event: DriveEvent; problem: Problem; userId: string | null }) {
  const { t, locale } = useI18n();
  const supabase = useState(createClient)[0];
  const { busy, error, run } = useAction();
  const going = !!userId && e.event_rsvps.some((r) => r.user_id === userId);
  const organizer = !!userId && e.organizer_id === userId;
  const planned = e.status === "planned";
  const when = formatDate(e.starts_at, locale, true);
  const link = () => `${window.location.origin}/problems/${problem.id}`;

  function toggleRsvp() {
    run("rsvp", async () => {
      const { error } = going
        ? await supabase.from("event_rsvps").delete().eq("event_id", e.id).eq("user_id", userId!)
        : await supabase.from("event_rsvps").insert({ event_id: e.id });
      if (error) throw error;
    });
  }

  function setStatus(status: "done" | "cancelled") {
    run(status, async () => {
      const { error } = await supabase.rpc("set_event_status", { p_event: e.id, p_status: status });
      if (error) throw error;
    });
  }

  return (
    <div className={`rounded-2xl border p-4 ${planned ? "border-brand/40 bg-brand/5" : "border-line opacity-80"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold" suppressHydrationWarning>
            {when}
          </p>
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            <MapPin className="size-3.5" /> {e.meeting_point}
          </p>
          {e.profiles && <p className="text-xs text-ink-soft">{fmt(t.events.organizedBy, { name: e.profiles.display_name })}</p>}
        </div>
        <span className="chip bg-surface-2">
          {e.status === "done" ? t.events.done : e.status === "cancelled" ? t.events.cancelled : fmt(t.events.going, { n: e.rsvp_count })}
        </span>
      </div>

      {e.checklist.length > 0 && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">{t.events.bring}:</span> {e.checklist.join(", ")}
        </p>
      )}
      {e.notes && <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{e.notes}</p>}
      {e.event_rsvps.length > 0 && (
        <p className="mt-2 flex items-start gap-1 text-xs text-ink-soft">
          <Users className="mt-0.5 size-3.5 shrink-0" />
          {e.event_rsvps.map((r) => r.profiles?.display_name ?? t.system.aPeer).join(", ")}
        </p>
      )}

      {planned && (
        <div className="mt-3 flex flex-wrap gap-2">
          {userId && !organizer && (
            <button onClick={toggleRsvp} disabled={!!busy} className={`${going ? "btn-primary" : "btn-secondary"} px-4 py-2`}>
              {busy === "rsvp" ? <Loader2 className="size-4 animate-spin" /> : going ? <Check className="size-4" /> : null}
              {going ? t.events.youAreGoing : t.events.rsvp}
            </button>
          )}
          <button
            className="btn-secondary px-4 py-2"
            onClick={() =>
              downloadFile(
                "sambhal-cleanup-drive.ics",
                driveIcs({
                  id: e.id,
                  title: `${t.events.title}: ${problem.title}`,
                  startsAt: e.starts_at,
                  where: e.meeting_point,
                  description: e.checklist.length ? `${t.events.bring}: ${e.checklist.join(", ")}` : "",
                  url: link(),
                }),
                "text/calendar",
              )
            }
          >
            <CalendarPlus className="size-4" /> {t.events.addToCalendar}
          </button>
          <button
            className="btn-secondary px-4 py-2"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(
                  fmt(t.events.shareText, { title: problem.title, when, where: e.meeting_point, bring: e.checklist.join(", "), link: link() }),
                )}`,
                "_blank",
                "noopener",
              )
            }
          >
            <Share2 className="size-4" /> {t.events.shareDrive}
          </button>
          {going && !organizer && (
            <button onClick={toggleRsvp} disabled={!!busy} className="text-xs text-ink-soft underline">
              {t.events.cancelRsvp}
            </button>
          )}
          {organizer && (
            <>
              <button onClick={() => setStatus("done")} disabled={!!busy} className="btn-primary px-4 py-2">
                <Check className="size-4" /> {t.events.markDone}
              </button>
              <button onClick={() => setStatus("cancelled")} disabled={!!busy} className="btn-secondary px-4 py-2 text-danger">
                <X className="size-4" /> {t.events.cancelDrive}
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function PlanDrive({ problemId }: { problemId: string }) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(nextSundayMorning);
  const [where, setWhere] = useState("");
  const [checklist, setChecklist] = useState(t.events.defaultChecklist);
  const [notes, setNotes] = useState("");

  if (!open) {
    return (
      <button className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" /> {t.events.plan}
      </button>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("create", async () => {
          const { error } = await supabase.rpc("create_event", {
            p_problem: problemId,
            p_starts_at: new Date(when).toISOString(),
            p_meeting_point: where,
            p_checklist: checklist.split("\n").map((s) => s.trim()).filter(Boolean),
            p_notes: notes || null,
          });
          if (error) throw error;
        });
        if (ok) setOpen(false);
      }}
    >
      <p className="text-sm text-ink-soft">{t.events.planHelp}</p>
      <div>
        <label className="label" htmlFor="drive-when">{t.events.when}</label>
        <input id="drive-when" type="datetime-local" required className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="drive-where">{t.events.meetingPoint}</label>
        <input
          id="drive-where"
          required
          minLength={2}
          maxLength={200}
          className="input"
          placeholder={t.events.meetingPlaceholder}
          value={where}
          onChange={(e) => setWhere(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="drive-bring">{t.events.checklist}</label>
        <textarea id="drive-bring" className="input min-h-24" value={checklist} onChange={(e) => setChecklist(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="drive-notes">{t.events.notes}</label>
        <input id="drive-notes" className="input" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
        <button className="btn-primary flex-1" disabled={!!busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {t.events.create}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
