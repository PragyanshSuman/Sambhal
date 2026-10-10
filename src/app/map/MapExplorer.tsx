"use client";

import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ProblemCard } from "@/components/ProblemCard";
import { ProblemsMap, type Bounds } from "@/components/map";
import { currentPosition, DEFAULT_CENTER, type LatLng } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { OPEN_STATUSES, PATHS, PATH_KEYS, type ProblemPath } from "@/lib/taxonomy";
import { PROBLEM_CARD_COLUMNS, type ProblemCard as Card } from "@/lib/types";

const VIEWS = {
  open: { label: "Open", statuses: OPEN_STATUSES },
  verified: { label: "Fixed", statuses: ["resolved", "verified"] },
  all: { label: "All", statuses: [...OPEN_STATUSES, "resolved", "verified"] },
} as const;

type View = keyof typeof VIEWS;

export function MapExplorer() {
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [view, setView] = useState<View>("open");
  const [path, setPath] = useState<ProblemPath | "any">("any");
  const [problems, setProblems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const supabase = useState(createClient)[0];

  const [refreshCounter, setRefreshCounter] = useState(0);

  const findMe = useCallback(() => {
    currentPosition()
      .then((p) => {
        setCenter(p);
        setLocError(null);
      })
      .catch((e: Error) => setLocError(e.message));
  }, []);

  // Auto center on user's location when they open the map
  useEffect(() => {
    findMe();
  }, [findMe]);

  // Real-time subscription to update map on the go
  useEffect(() => {
    const channel = supabase
      .channel('map-problems')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'problems' },
        () => {
          setRefreshCounter((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;
    // Debounce map drags so we query once the map settles.
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from("problems")
        .select(PROBLEM_CARD_COLUMNS)
        .in("status", [...VIEWS[view].statuses])
        .gte("lat", bounds.minLat)
        .lte("lat", bounds.maxLat)
        .gte("lng", bounds.minLng)
        .lte("lng", bounds.maxLng)
        .order("created_at", { ascending: false })
        .limit(300);
      if (path !== "any") q = q.eq("path", path);
      const { data } = await q.overrideTypes<Card[], { merge: false }>();
      if (!cancelled) {
        setProblems(data ?? []);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bounds, view, path, supabase, refreshCounter]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      <div className="relative h-[55%] lg:h-full lg:flex-1">
        <ProblemsMap problems={problems} center={center} onBoundsChange={setBounds} />
        <button
          onClick={findMe}
          className="btn-secondary absolute bottom-4 right-4 z-[500] shadow-md"
          aria-label="Go to my location"
        >
          <LocateFixed className="size-4" /> Near me
        </button>
        {locError && (
          <p className="absolute left-4 right-20 top-4 z-[500] rounded-xl bg-surface/95 p-2 text-xs text-ink-soft shadow">
            {locError}
          </p>
        )}
      </div>

      <aside className="flex min-h-0 flex-1 flex-col border-t border-line lg:w-[420px] lg:flex-none lg:border-l lg:border-t-0">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist">
            {(Object.keys(VIEWS) as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  view === v ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
                }`}
              >
                {VIEWS[v].label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <PathFilter active={path === "any"} onClick={() => setPath("any")} label="All paths" />
            {PATH_KEYS.map((k) => (
              <PathFilter
                key={k}
                active={path === k}
                onClick={() => setPath(k)}
                label={PATHS[k].short}
                color={PATHS[k].color}
              />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <p className="text-sm text-ink-soft">
            {loading ? "Loading…" : `${problems.length} in this area`}
          </p>
          {problems.map((p) => (
            <ProblemCard key={p.id} problem={p} />
          ))}
          {!loading && problems.length === 0 && (
            <p className="card p-6 text-center text-sm text-ink-soft">
              Nothing here yet. Zoom out, or be the first to report something.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function PathFilter({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip shrink-0 border py-1 ${active ? "border-ink bg-ink text-bg" : "border-line text-ink-soft"}`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}
