import { z } from "zod";
import { getUserId } from "@/lib/supabase/server";
import { triageProblem } from "@/lib/triage";

const Body = z.object({
  description: z.string().max(2000).default(""),
  image: z
    .object({
      base64: z.string().max(4_000_000),
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!(await getUserId())) {
    return Response.json({ error: "Please sign in first" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.data.description.trim() && !parsed.data.image) {
    return Response.json({ error: "Add a photo or a description" }, { status: 400 });
  }
  return Response.json(await triageProblem(parsed.data));
}
