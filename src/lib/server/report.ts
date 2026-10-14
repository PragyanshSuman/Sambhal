import "server-only";

/**
 * Free error alerting: structured logs (your host keeps them) plus, if ERROR_WEBHOOK_URL is
 * set, a message to a Slack or Discord incoming webhook. Never throws.
 */
export async function reportError(source: string, message: string, details: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: "error", source, message, ...details, at: new Date().toISOString() }));
  const hook = process.env.ERROR_WEBHOOK_URL;
  if (!hook) return;
  const text = `🚨 Sambhal ${source}: ${message}\n${Object.entries(details)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n")
    .slice(0, 1500)}`;
  try {
    // Slack reads `text`, Discord reads `content`.
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Alerting must never break the request.
  }
}
