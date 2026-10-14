import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AppRuntime } from "@/components/AppRuntime";
import { InstallButton } from "@/components/InstallButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HeaderShell, SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/client";
import { LOCALES } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
    title: { default: t.meta.title, template: "%s · Sambhal" },
    description: t.meta.description,
    applicationName: "Sambhal",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/192", apple: "/icons/180" },
    appleWebApp: { capable: true, title: "Sambhal", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1121" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <Suspense fallback={<HeaderShell t={t} />}>
            <SiteHeader />
          </Suspense>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line py-8 text-center text-sm text-ink-soft">
            <p>{t.footer.tagline}</p>
            <p className="mt-1">{t.footer.principles}</p>
            <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Link href="/impact" className="underline">{t.nav.impact}</Link>
              <Link href="/areas" className="underline">{t.nav.areas}</Link>
              <Link href="/terms" className="underline">{t.footer.terms}</Link>
              <Link href="/privacy" className="underline">{t.footer.privacy}</Link>
              <Link href="/grievance" className="underline">{t.footer.grievance}</Link>
              <InstallButton />
              <LanguageSwitcher />
            </nav>
          </footer>
          <Suspense>
            <AppRuntime />
          </Suspense>
        </I18nProvider>
      </body>
    </html>
  );
}
