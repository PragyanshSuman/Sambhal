import type { Metadata } from "next";
import { Mail, MapPin, UserRound } from "lucide-react";
import { operator } from "@/content/legal";
import { getDictionary } from "@/i18n/server";
import { GrievanceForm } from "./GrievanceForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).grievance.title };
}

export default async function GrievancePage() {
  const t = await getDictionary();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t.grievance.title}</h1>
      <p className="mt-2 text-ink-soft">{t.grievance.intro}</p>

      <section className="card mt-8 space-y-2 p-5">
        <h2 className="font-bold">{t.grievance.officer}</h2>
        <p className="flex items-center gap-2"><UserRound className="size-4 text-brand" /> {operator.officer}, {operator.name}</p>
        <p className="flex items-center gap-2">
          <Mail className="size-4 text-brand" /> <a href={`mailto:${operator.email}`} className="underline">{operator.email}</a>
        </p>
        <p className="flex items-center gap-2"><MapPin className="size-4 text-brand" /> {operator.address}</p>
        <p className="pt-2 text-sm text-ink-soft">{t.grievance.timelines}</p>
      </section>

      <GrievanceForm />
    </div>
  );
}
