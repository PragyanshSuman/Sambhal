"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;

  return (
    <div className="flex gap-2">
      <button
        className="btn-secondary flex-1"
        onClick={() =>
          window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\nCan you help? ${url()}`)}`, "_blank", "noopener")
        }
      >
        <Share2 className="size-4" /> WhatsApp
      </button>
      <button
        className="btn-secondary flex-1"
        onClick={async () => {
          if (navigator.share) {
            await navigator.share({ title, url: url() }).catch(() => {});
            return;
          }
          await navigator.clipboard.writeText(url());
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
        {copied ? "Copied" : "Share link"}
      </button>
    </div>
  );
}
