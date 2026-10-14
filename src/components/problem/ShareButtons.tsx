"use client";

import { Check, Link2, Share2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

/**
 * WhatsApp and native sharing. The link unfurls into a rich preview card
 * (see opengraph-image.tsx), showing before/after once something is fixed.
 */
export function ShareButtons({ title, path, fixed }: { title: string; path: string; fixed: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;
  const text = fixed ? fmt(t.share.beforeAfterText, { title }) : `${title}\n${t.share.canYouHelp}`;

  return (
    <div className="space-y-2">
      {fixed && (
        <button
          className="btn-primary w-full"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url()}`)}`, "_blank", "noopener")}
        >
          <Sparkles className="size-4" /> {t.share.beforeAfter}
        </button>
      )}
      <div className="flex gap-2">
        <button
          className="btn-secondary flex-1"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url()}`)}`, "_blank", "noopener")}
        >
          <Share2 className="size-4" /> {t.share.whatsapp}
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={async () => {
            if (navigator.share) {
              await navigator.share({ title, text, url: url() }).catch(() => {});
              return;
            }
            await navigator.clipboard.writeText(url());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copied ? t.common.copied : t.share.link}
        </button>
      </div>
    </div>
  );
}
