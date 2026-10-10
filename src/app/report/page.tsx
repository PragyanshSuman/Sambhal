import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { connection } from "next/server";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report a problem" };

export default async function ReportPage() {
  await connection();
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/report");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Report a problem</h1>
      <p className="mt-2 text-ink-soft">
        A clear photo and an accurate pin matter most. We&apos;ll suggest how the community can deal with it.
      </p>
      <ReportForm userId={userId} />
    </div>
  );
}
