import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n/server";
import { getUserId } from "@/lib/supabase/server";
import { ReportForm } from "./ReportForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).report.title };
}

export default async function ReportPage() {
  const t = await getDictionary();
  await connection();
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/report");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t.report.title}</h1>
      <p className="mt-2 text-ink-soft">{t.report.intro}</p>
      <ReportForm userId={userId} />
    </div>
  );
}
