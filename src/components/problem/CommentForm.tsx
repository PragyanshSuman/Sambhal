"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { PhotoInput } from "@/components/PhotoInput";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";
import { useAction } from "./useAction";

export function CommentForm({ problemId, userId }: { problemId: string; userId: string }) {
  const { t } = useI18n();
  const supabase = useState(createClient)[0];
  const { busy, error, run } = useAction();
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run("comment", async () => {
      const photoUrl = photo ? await uploadPhoto(supabase, userId, photo) : null;
      const { error } = await supabase
        .from("updates")
        .insert({ problem_id: problemId, user_id: userId, kind: "comment", body: body.trim(), photo_url: photoUrl });
      if (error) throw error;
    });
    if (ok) {
      setBody("");
      setPhoto(null);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <textarea
        className="input min-h-20"
        maxLength={2000}
        placeholder={t.comment.placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PhotoInput photo={photo} onChange={setPhoto} label={t.common.photo} />
        <button className="btn-primary" disabled={!!busy || (!body.trim() && !photo)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {t.comment.post}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
