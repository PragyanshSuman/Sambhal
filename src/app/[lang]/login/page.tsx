import type { Metadata } from "next";
import { connection } from "next/server";
import { getDictionary } from "@/i18n/server";
import { safeNext } from "@/lib/redirect";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).login.title };
}

export default async function LoginPage(props: PageProps<"/[lang]/login">) {
  const t = await getDictionary();
  await connection();
  const params = await props.searchParams;
  const next = safeNext(params.next);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t.login.title}</h1>
      <p className="mt-2 text-ink-soft">{t.login.intro}</p>
      {params.error === "link" && <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{t.login.linkExpired}</p>}
      <LoginForm next={next} />
    </div>
  );
}
