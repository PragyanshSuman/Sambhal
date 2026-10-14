"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/problem/useAction";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";

export function GrievanceActions({ id, status }: { id: string; status: "open" | "acknowledged" }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const [response, setResponse] = useState("");

  function update(next: "acknowledged" | "resolved") {
    run(next, async () => {
      const { error } = await createClient().rpc("update_grievance", { p_id: id, p_status: next, p_response: response || null });
      if (error) throw error;
    });
  }

  return (
    <div className="space-y-2">
      <textarea className="input min-h-16" placeholder={t.admin.response} value={response} onChange={(e) => setResponse(e.target.value)} maxLength={4000} />
      <div className="flex gap-2">
        {status === "open" && (
          <button className="btn-secondary" disabled={!!busy} onClick={() => update("acknowledged")}>
            {busy === "acknowledged" && <Loader2 className="size-4 animate-spin" />} {t.admin.acknowledge}
          </button>
        )}
        <button className="btn-primary" disabled={!!busy} onClick={() => update("resolved")}>
          {busy === "resolved" && <Loader2 className="size-4 animate-spin" />} {t.admin.resolve}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
