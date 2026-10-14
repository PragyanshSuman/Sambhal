"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { errorMessage } from "@/lib/format";
import { downloadFile } from "@/lib/ics";
import { createClient } from "@/lib/supabase/client";

/** DPDP Act 2023: access to and erasure of your personal data. */
export function DataControls({ userId }: { userId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy("export");
    setError(null);
    try {
      const supabase = createClient();
      const mine = <T,>(q: PromiseLike<{ data: T | null; error: unknown }>) =>
        q.then(({ data, error }) => {
          if (error) throw error;
          return data;
        });
      const [profile, helper, problems, updates, confirmations, supports, notifications, rsvps, events, grievances] = await Promise.all([
        mine(supabase.from("profiles").select("*").eq("id", userId).maybeSingle()),
        mine(supabase.from("helpers").select("*").eq("user_id", userId).maybeSingle()),
        mine(supabase.from("problems").select("*").eq("reporter_id", userId)),
        mine(supabase.from("updates").select("*").eq("user_id", userId)),
        mine(supabase.from("confirmations").select("*").eq("user_id", userId)),
        mine(supabase.from("supports").select("*").eq("user_id", userId)),
        mine(supabase.from("notifications").select("*").eq("user_id", userId)),
        mine(supabase.from("event_rsvps").select("*").eq("user_id", userId)),
        mine(supabase.from("events").select("*").eq("organizer_id", userId)),
        mine(supabase.from("grievances").select("*").eq("user_id", userId)),
      ]);
      const { data: auth } = await supabase.auth.getUser();
      const account = { id: auth.user?.id, email: auth.user?.email, phone: auth.user?.phone, created_at: auth.user?.created_at };
      const dump = { exported_at: new Date().toISOString(), account, profile, helper, problems, updates, confirmations, supports, notifications, rsvps, events, grievances };
      downloadFile(`sambhal-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dump, null, 2), "application/json");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    setError(null);
    try {
      const supabase = createClient();
      // Photos first: storage files can only be removed through the Storage API.
      const { data: files } = await supabase.storage.from("photos").list(userId, { limit: 1000 });
      if (files?.length) {
        const { error } = await supabase.storage.from("photos").remove(files.map((f) => `${userId}/${f.name}`));
        if (error) throw error;
      }
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">{t.me.data.title}</h2>
      <p className="text-sm text-ink-soft">{t.me.data.help}</p>
      <button onClick={exportData} disabled={!!busy} className="btn-secondary w-full">
        {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {t.me.data.download}
      </button>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="w-full text-sm text-danger underline">
          {t.me.data.delete}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-danger/40 p-3">
          <p className="text-sm">{t.me.data.deleteConfirm}</p>
          <input className="input" value={word} onChange={(e) => setWord(e.target.value)} aria-label={t.me.data.deleteWord} autoComplete="off" />
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </button>
            <button className="btn-danger flex-1" disabled={word !== t.me.data.deleteWord || !!busy} onClick={deleteAccount}>
              {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {busy === "delete" ? t.me.data.deleting : t.me.data.delete}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
