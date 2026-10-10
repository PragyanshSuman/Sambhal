"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/problem/useAction";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const supabase = useState(createClient)[0];
  const { busy, error, run } = useAction();
  const [name, setName] = useState(profile.display_name);
  const [area, setArea] = useState(profile.area ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        const ok = await run("profile", async () => {
          const { error } = await supabase
            .from("profiles")
            .update({ display_name: name.trim(), area: area.trim() || null })
            .eq("id", profile.id);
          if (error) throw error;
        });
        setSaved(ok);
      }}
    >
      <h2 className="font-bold">Profile</h2>
      <div>
        <label className="label" htmlFor="display_name">Name shown to peers</label>
        <input id="display_name" className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="area">Community / Area</label>
        <input id="area" className="input" maxLength={80} placeholder="e.g. Indiranagar 2nd Stage" value={area} onChange={(e) => setArea(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={!!busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {saved ? "Saved" : "Save"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

export function MarkAllRead() {
  const supabase = useState(createClient)[0];
  const { busy, run } = useAction();
  return (
    <button
      className="text-sm font-semibold text-brand"
      disabled={!!busy}
      onClick={() =>
        run("read", async () => {
          const { error } = await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .is("read_at", null);
          if (error) throw error;
        })
      }
    >
      Mark all read
    </button>
  );
}
