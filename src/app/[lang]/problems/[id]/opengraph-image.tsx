import { ImageResponse } from "next/og";
import { dictionaryFor } from "@/i18n/dictionaries";
import { createPublicClient } from "@/lib/supabase/public";
import { PATHS, STATUSES, type Category, type ProblemPath, type ProblemStatus } from "@/lib/taxonomy";

// The rich preview WhatsApp and social apps show for a shared problem link.
// Once fixed, it becomes a before/after card: the best growth loop we have.

export const alt = "Sambhal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  title: string;
  category: Category;
  path: ProblemPath;
  status: ProblemStatus;
  locality: string | null;
  photos: string[];
  confirm_count: number;
  support_count: number;
};

// Satori (the image renderer) can't shape Devanagari correctly, so the image uses English
// labels, and a Hindi title is left to the link preview text, which phones render properly.
const DEVANAGARI = /[ऀ-ॿ]/;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = dictionaryFor("en");
  const supabase = createPublicClient();

  const { data: p } = UUID.test(id)
    ? await supabase
        .from("problems")
        .select("title,category,path,status,locality,photos,confirm_count,support_count")
        .eq("id", id)
        .maybeSingle<Row>()
    : { data: null };

  const fixed = p && (p.status === "verified" || p.status === "resolved");
  const { data: resolution } = fixed
    ? await supabase
        .from("updates")
        .select("photo_url")
        .eq("problem_id", id)
        .eq("kind", "resolution")
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ photo_url: string }>()
    : { data: null };

  const title = p && !DEVANAGARI.test(p.title) ? p.title : p ? "" : "Sambhal";
  const status = p ? t.taxonomy.statuses[p.status] : "";
  const statusColor = p ? STATUSES[p.status].color : "#238472";
  const subtitle = p
    ? [t.taxonomy.categories[p.category], p.locality && !DEVANAGARI.test(p.locality) ? p.locality : null].filter(Boolean).join(" · ")
    : t.meta.description;
  const before = p?.photos[0];
  const after = resolution?.photo_url;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b1121", color: "white" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, width: before ? 640 : 1200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "#30a58c", fontSize: 32, fontWeight: 700 }}>
              S
            </div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>Sambhal</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {p && (
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ display: "flex", padding: "6px 16px", borderRadius: 999, background: statusColor, fontSize: 24, fontWeight: 700 }}>{status}</div>
                <div style={{ display: "flex", padding: "6px 16px", borderRadius: 999, border: `2px solid ${PATHS[p.path].color}`, fontSize: 24 }}>
                  {t.taxonomy.paths[p.path].short}
                </div>
              </div>
            )}
            {title && <div style={{ display: "flex", fontSize: title.length > 60 ? 44 : 56, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>}
            <div style={{ display: "flex", fontSize: 26, color: "#94a3b8" }}>{subtitle}</div>
          </div>
          {p && (
            <div style={{ display: "flex", gap: 32, fontSize: 26, color: "#cbd5e1" }}>
              <Count color="#4fc1a8" n={p.confirm_count} label={t.problem.confirmed} />
              <Count color="#fbbf24" n={p.support_count} label={t.problem.affected} />
              {!fixed && <div style={{ display: "flex", color: "#4fc1a8" }}>{t.share.canYouHelp}</div>}
            </div>
          )}
        </div>
        {before && (
          <div style={{ display: "flex", flexDirection: after ? "row" : "column", width: 560, height: 630 }}>
            {[
              { src: before, label: after ? t.impact.before : null },
              ...(after ? [{ src: after, label: t.impact.after }] : []),
            ].map(({ src, label }) => (
              <div key={src} style={{ display: "flex", position: "relative", width: after ? 280 : 560, height: 630 }}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered to PNG by Satori */}
                <img src={src} width={after ? 280 : 560} height={630} style={{ objectFit: "cover" }} />
                {label && (
                  <div style={{ display: "flex", position: "absolute", bottom: 24, left: 24, padding: "6px 16px", borderRadius: 999, background: "rgba(0,0,0,0.7)", fontSize: 24, fontWeight: 700 }}>
                    {label}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    size,
  );
}

function Count({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: color }} />
      {n} {label}
    </div>
  );
}
