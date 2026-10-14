"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { errorMessage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const KINDS = ["takedown", "privacy", "account", "other"] as const;

export function GrievanceForm() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("takedown");
  const [url, setUrl] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("submit_grievance", {
      p_name: name,
      p_email: email,
      p_kind: kind,
      p_url: url,
      p_details: details,
    });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else setDone(String(data).slice(0, 8).toUpperCase());
  }

  if (done) return <p className="card mt-8 p-5 font-semibold text-brand">{fmt(t.grievance.submitted, { id: done })}</p>;

  return (
    <form onSubmit={submit} className="card mt-8 space-y-4 p-5">
      <h2 className="font-bold">{t.grievance.formTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="g-name">{t.grievance.name}</label>
          <input id="g-name" required maxLength={100} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="g-email">{t.grievance.email}</label>
          <input id="g-email" type="email" required maxLength={200} className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="g-kind">{t.grievance.kind}</label>
        <select id="g-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{t.grievance.kinds[k]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="g-url">{t.grievance.url}</label>
        <input id="g-url" type="url" maxLength={500} className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </div>
      <div>
        <label className="label" htmlFor="g-details">{t.grievance.details}</label>
        <textarea id="g-details" required minLength={10} maxLength={4000} className="input min-h-32" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} {t.grievance.submit}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
