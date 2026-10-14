import { timingSafeEqual } from "node:crypto";
import webpush, { WebPushError } from "web-push";
import { z } from "zod";
import { reportError } from "@/lib/server/report";
import { createPublicClient } from "@/lib/supabase/public";

// Called by the database (pg_net) for every new notification; see the
// community_platform migration. Sends free web push via VAPID.

const Body = z.object({
  title: z.string().max(100),
  body: z.string().max(500),
  url: z.string().startsWith("/").max(200),
  subscriptions: z
    .array(z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }))
    .max(20),
});

function sameSecret(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !publicKey || !privateKey) return Response.json({ error: "Push is not configured" }, { status: 503 });
  if (!sameSecret(request.headers.get("x-push-secret"), secret)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", publicKey, privateKey);
  const { title, body, url, subscriptions } = parsed.data;
  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subscriptions.map((sub) => webpush.sendNotification(sub, payload, { TTL: 24 * 3600, urgency: "normal" })),
  );

  const supabase = createPublicClient();
  let sent = 0;
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "fulfilled") {
        sent++;
        return;
      }
      const err = r.reason;
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        // The browser revoked this subscription; stop sending to it.
        await supabase.rpc("prune_push_subscription", { p_endpoint: subscriptions[i].endpoint, p_secret: secret });
      } else {
        await reportError("push", err instanceof Error ? err.message : String(err));
      }
    }),
  );

  return Response.json({ sent, failed: subscriptions.length - sent });
}
