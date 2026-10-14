import Link from "next/link";
import { getDictionary } from "@/i18n/server";

export default async function NotFound() {
  const t = await getDictionary();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{t.problem.notFoundTitle}</h1>
      <p className="mt-2 text-ink-soft">{t.problem.notFoundBody}</p>
      <Link href="/map" className="btn-primary mt-6">
        {t.common.backToMap}
      </Link>
    </div>
  );
}
