"use client";

import { Ban, EyeOff, Eye, Loader2, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { useAction } from "./problem/useAction";

/** Moderator-only buttons: hide/restore content, dismiss flags, suspend the author. */
export function ModerationControls({
  type,
  id,
  hidden,
  authorId,
  authorBanned,
  showDismiss = false,
}: {
  type: "problem" | "update";
  id: string;
  hidden: boolean;
  authorId?: string | null;
  authorBanned?: boolean;
  showDismiss?: boolean;
}) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();

  function moderate(action: "hide" | "restore" | "dismiss") {
    const note = action === "hide" ? window.prompt(t.moderation.reasonPrompt) : null;
    if (action === "hide" && note === null) return;
    run(action, async () => {
      const { error } = await createClient().rpc("moderate_content", { p_type: type, p_id: id, p_action: action, p_note: note });
      if (error) throw error;
    });
  }

  function ban() {
    if (!authorId) return;
    const reason = authorBanned ? null : window.prompt(t.moderation.reasonPrompt);
    if (!authorBanned && reason === null) return;
    run("ban", async () => {
      const { error } = await createClient().rpc("set_user_ban", { p_user: authorId, p_banned: !authorBanned, p_reason: reason });
      if (error) throw error;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <button className="btn-secondary px-3 py-1 text-xs" disabled={!!busy} onClick={() => moderate(hidden ? "restore" : "hide")}>
        {busy === "hide" || busy === "restore" ? <Loader2 className="size-3 animate-spin" /> : hidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
        {hidden ? t.moderation.restore : t.moderation.hide}
      </button>
      {showDismiss && (
        <button className="btn-secondary px-3 py-1 text-xs" disabled={!!busy} onClick={() => moderate("dismiss")}>
          <X className="size-3" /> {t.moderation.dismiss}
        </button>
      )}
      {authorId && (
        <button className="btn-secondary px-3 py-1 text-xs text-danger" disabled={!!busy} onClick={ban}>
          <Ban className="size-3" /> {authorBanned ? t.moderation.unban : t.moderation.ban}
        </button>
      )}
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
