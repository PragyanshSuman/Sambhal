import type { NextRequest } from "next/server";
import { hasLocale, LOCALE_COOKIE, pickLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  // Already localized (/hi/map): serve as is.
  if (hasLocale(first)) {
    return updateSession(request, null, pathname.slice(first.length + 1) || "/");
  }

  // Unprefixed (/map): keep the URL, serve the reader's language.
  const locale = pickLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
  const rewriteTo = request.nextUrl.clone();
  rewriteTo.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return updateSession(request, rewriteTo, pathname);
}

export const config = {
  // Skip API and auth route handlers, Next internals, the service worker, manifest, icons and image files.
  matcher: [
    "/((?!api/|auth/|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
