import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

// Uptime checks (GitHub Actions, UptimeRobot, etc.) hit this. 200 = app and database are up.
export async function GET() {
  await connection();
  const started = Date.now();
  try {
    const { error } = await createPublicClient().rpc("public_stats").abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    return Response.json({ ok: true, db: "up", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
