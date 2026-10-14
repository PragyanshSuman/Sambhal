import { reportError } from "@/lib/server/report";

// Browser errors, sent with navigator.sendBeacon from AppRuntime.
export async function POST(request: Request) {
  const raw = (await request.text()).slice(0, 8000);
  let body: { message?: unknown; stack?: unknown; url?: unknown } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "unknown";
  await reportError("browser", message, {
    url: typeof body.url === "string" ? body.url.slice(0, 200) : undefined,
    stack: typeof body.stack === "string" ? body.stack.slice(0, 1500) : undefined,
    userAgent: request.headers.get("user-agent")?.slice(0, 200),
  });
  return new Response(null, { status: 204 });
}
