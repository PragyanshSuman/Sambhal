/**
 * A same-origin path to send the user to after sign-in, or "/".
 * Rejects absolute URLs and protocol-relative tricks such as "//evil.com" and
 * "/\evil.com" (browsers treat the backslash as a slash).
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.includes("\\")) return "/";
  // Control characters (tabs, newlines) are stripped by URL parsers and can smuggle a host.
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
