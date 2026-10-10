import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { HeaderShell, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sambhal: report it, we deal with it", template: "%s · Sambhal" },
  description:
    "Report any problem in your community. Peers confirm it, someone takes ownership, and the community verifies the fix. No waiting on anyone.",
  applicationName: "Sambhal",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#121513" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<HeaderShell />}>
          <SiteHeader />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-8 text-center text-sm text-ink-soft">
          <p>Sambhal. Peers dealing with it, together.</p>
          <p className="mt-1">Non-partisan. No blaming individuals. Safety first.</p>
        </footer>
      </body>
    </html>
  );
}
