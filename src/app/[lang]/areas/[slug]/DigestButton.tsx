"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

/** A ready-to-paste weekly update for the neighbourhood WhatsApp group. Free and manual by design. */
export function DigestButton({
  area,
  slug,
  newCount,
  fixedCount,
  oldest,
}: {
  area: string;
  slug: string;
  newCount: number;
  fixedCount: number;
  oldest: { id: string; title: string; days: number }[];
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  function text() {
    const origin = window.location.origin;
    return [
      `*${fmt(t.areas.digestTitle, { area })}*`,
      "",
      `🆕 ${fmt(t.areas.digestNew, { n: newCount })}`,
      `✅ ${fmt(t.areas.digestFixed, { n: fixedCount })}`,
      ...(oldest.length
        ? ["", `⏳ ${t.areas.digestOldest}`, ...oldest.map((p) => `• ${p.title} (${fmt(t.common.days, { n: p.days })}) ${origin}/problems/${p.id}`)]
        : []),
      "",
      fmt(t.areas.digestCta, { link: `${origin}/areas/${slug}` }),
    ].join("\n");
  }

  return (
    <div className="flex gap-2">
      <button
        className="btn-secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(text());
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t.common.copied : t.areas.digest}
      </button>
      <button
        className="btn-primary"
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank", "noopener")}
        aria-label={t.common.whatsapp}
      >
        <Share2 className="size-4" /> {t.common.whatsapp}
      </button>
    </div>
  );
}
