import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "./env";

const PROTECTED = ["/report", "/me", "/admin"];

/**
 * Refreshes the Supabase session cookie on every request and gates signed-in pages.
 * `rewriteTo` serves a localized route (e.g. /hi/map) while the URL stays /map.
 */
export async function updateSession(request: NextRequest, rewriteTo: URL | null, pathWithoutLocale: string) {
  const pass = () => (rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request }));
  let response = pass();

  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = pass();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Must run right after creating the client: it refreshes an expired session.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && PROTECTED.some((p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathWithoutLocale + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
