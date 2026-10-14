import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportError } = await import("@/lib/server/report");
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  await reportError("server", message, {
    digest,
    path: request.path,
    method: request.method,
    route: context.routePath,
    type: context.routeType,
  });
};
