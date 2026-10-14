import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { privacy } from "@/content/legal";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: privacy[await getLocale()].title };
}

export default async function PrivacyPage() {
  const t = await getDictionary();
  const doc = privacy[await getLocale()];
  return (
    <LegalPage {...doc}>
      <p className="mt-10">
        <Link href="/grievance" className="btn-secondary">{t.footer.grievance}</Link>
      </p>
    </LegalPage>
  );
}
