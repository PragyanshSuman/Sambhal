import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { terms } from "@/content/legal";
import { getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: terms[await getLocale()].title };
}

export default async function TermsPage() {
  return <LegalPage {...terms[await getLocale()]} />;
}
