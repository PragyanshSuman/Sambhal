import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  await connection();
  const params = await props.searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-ink-soft">
        No password. We email you a 6-digit code. Your name is shown on what you report and fix; your email never is.
      </p>
      {params.error === "link" && (
        <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          That sign-in link has expired. Request a new code below.
        </p>
      )}
      <LoginForm next={next} />
    </div>
  );
}
