import { z } from "zod";
import { DRAFT_KINDS, draftText, type DraftKind } from "@/lib/draft";
import { createClient } from "@/lib/supabase/server";
import type { Problem } from "@/lib/types";

const Body = z.object({
  problemId: z.uuid(),
  kind: z.enum(Object.keys(DRAFT_KINDS) as [DraftKind, ...DraftKind[]]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return Response.json({ error: "Please sign in first" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: problem } = await supabase
    .from("problems")
    .select("*")
    .eq("id", parsed.data.problemId)
    .single<Problem>();
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  const link = new URL(`/problems/${problem.id}`, request.url).toString();
  return Response.json({ text: await draftText(parsed.data.kind, problem, link) });
}
