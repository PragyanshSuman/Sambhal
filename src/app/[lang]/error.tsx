"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{t.errors.title}</h1>
      <p className="mt-2 text-ink-soft">
        {t.errors.body}
        {error.digest && <span className="mt-1 block font-mono text-xs">Ref: {error.digest}</span>}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={() => retry()} className="btn-primary">
          {t.common.tryAgain}
        </button>
        <Link href="/" className="btn-secondary">
          {t.common.home}
        </Link>
      </div>
    </div>
  );
}
