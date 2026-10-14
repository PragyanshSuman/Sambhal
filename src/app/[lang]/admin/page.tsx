import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ModerationControls } from "@/components/ModerationControls";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { formatDate, hoursUntil, isoDaysAgo, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { FlagReason } from "@/lib/taxonomy";
import { GrievanceActions } from "./GrievanceActions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).admin.title, robots: { index: false } };
}

const TABS = ["flags", "hidden", "grievances", "activity", "log"] as const;
type Tab = (typeof TABS)[number];

type Supabase = Awaited<ReturnType<typeof createClient>>;

export default async function AdminPage(props: PageProps<"/[lang]/admin">) {
  const t = await getDictionary();
  const locale = await getLocale();
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/admin");
  const { data: mod } = await supabase.from("moderators").select("user_id").eq("user_id", userId).maybeSingle();
  if (!mod) {
    return <p className="mx-auto max-w-md px-4 py-24 text-center text-ink-soft">{t.admin.notAllowed}</p>;
  }

  const { tab: rawTab } = await props.searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "flags";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t.admin.title}</h1>
      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/admin?tab=${k}`}
            className={`flex-1 rounded-full px-4 py-1.5 text-center text-sm font-semibold whitespace-nowrap ${tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {t.admin.tabs[k]}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "flags" && <Flags supabase={supabase} t={t} locale={locale} />}
        {tab === "hidden" && <Hidden supabase={supabase} t={t} locale={locale} />}
        {tab === "grievances" && <Grievances supabase={supabase} t={t} locale={locale} />}
        {tab === "activity" && <Activity supabase={supabase} t={t} />}
        {tab === "log" && <Log supabase={supabase} locale={locale} />}
      </div>
    </div>
  );
}

type Props = { supabase: Supabase; t: Dictionary; locale: Locale };

type FlagRow = {
  id: string;
  target_type: "problem" | "update";
  target_id: string;
  problem_id: string;
  reason: FlagReason;
  note: string | null;
  created_at: string;
  problems: { title: string; hidden_at: string | null; reporter_id: string | null } | null;
};

async function Flags({ supabase, t, locale }: Props) {
  const { data } = await supabase
    .from("content_flags")
    .select("id,target_type,target_id,problem_id,reason,note,created_at,problems(title,hidden_at,reporter_id)")
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .limit(300)
    .overrideTypes<FlagRow[], { merge: false }>();
  const flags = data ?? [];
  if (flags.length === 0) return <p className="text-ink-soft">{t.admin.noFlags}</p>;

  const groups = new Map<string, FlagRow[]>();
  for (const f of flags) groups.set(`${f.target_type}:${f.target_id}`, [...(groups.get(`${f.target_type}:${f.target_id}`) ?? []), f]);

  const updateIds = flags.filter((f) => f.target_type === "update").map((f) => f.target_id);
  const { data: updates } = updateIds.length
    ? await supabase.from("updates").select("id,body,photo_url,user_id,hidden_at").in("id", updateIds)
    : { data: [] as { id: string; body: string; photo_url: string | null; user_id: string | null; hidden_at: string | null }[] };

  return (
    <ul className="space-y-3">
      {[...groups.values()].map((group) => {
        const first = group[0];
        const update = first.target_type === "update" ? updates?.find((u) => u.id === first.target_id) : null;
        const hidden = first.target_type === "problem" ? !!first.problems?.hidden_at : !!update?.hidden_at;
        return (
          <li key={first.target_id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="chip bg-surface-2">{first.target_type === "problem" ? t.admin.problem : t.admin.comment}</span>{" "}
                <Link href={`/problems/${first.problem_id}`} className="font-semibold underline">
                  {first.problems?.title ?? first.problem_id}
                </Link>
              </p>
              <span className="chip bg-danger-soft text-danger">{fmt(t.admin.flagsCount, { n: group.length })}</span>
            </div>
            {update && <p className="rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap">{update.body}</p>}
            <ul className="space-y-1 text-xs text-ink-soft">
              {group.map((f) => (
                <li key={f.id}>
                  {t.flag.reasons[f.reason]}
                  {f.note && `: "${f.note}"`} · {timeAgo(f.created_at, locale)}
                </li>
              ))}
            </ul>
            <ModerationControls
              type={first.target_type}
              id={first.target_id}
              hidden={hidden}
              authorId={first.target_type === "problem" ? first.problems?.reporter_id : update?.user_id}
              showDismiss
            />
          </li>
        );
      })}
    </ul>
  );
}

async function Hidden({ supabase, t, locale }: Props) {
  const [{ data: problems }, { data: updates }] = await Promise.all([
    supabase.from("problems").select("id,title,hidden_at,hidden_reason,reporter_id").not("hidden_at", "is", null).order("hidden_at", { ascending: false }).limit(100),
    supabase.from("updates").select("id,problem_id,body,hidden_at,user_id").not("hidden_at", "is", null).order("hidden_at", { ascending: false }).limit(100),
  ]);
  if (!problems?.length && !updates?.length) return <p className="text-ink-soft">{t.admin.noHidden}</p>;
  return (
    <ul className="space-y-3">
      {(problems ?? []).map((p) => (
        <li key={p.id} className="card space-y-2 p-4">
          <p className="text-sm">
            <span className="chip bg-surface-2">{t.admin.problem}</span>{" "}
            <Link href={`/problems/${p.id}`} className="font-semibold underline">{p.title}</Link>
            <span className="text-ink-soft"> · {p.hidden_reason} · {timeAgo(p.hidden_at!, locale)}</span>
          </p>
          <ModerationControls type="problem" id={p.id} hidden authorId={p.reporter_id} />
        </li>
      ))}
      {(updates ?? []).map((u) => (
        <li key={u.id} className="card space-y-2 p-4">
          <p className="text-sm">
            <span className="chip bg-surface-2">{t.admin.comment}</span>{" "}
            <Link href={`/problems/${u.problem_id}`} className="underline">{u.body.slice(0, 140)}</Link>
          </p>
          <ModerationControls type="update" id={u.id} hidden authorId={u.user_id} />
        </li>
      ))}
    </ul>
  );
}

type GrievanceRow = {
  id: string;
  name: string;
  email: string;
  kind: "takedown" | "privacy" | "account" | "other";
  url: string | null;
  details: string;
  status: "open" | "acknowledged" | "resolved";
  response: string | null;
  created_at: string;
};

async function Grievances({ supabase, t, locale }: Props) {
  const { data } = await supabase
    .from("grievances")
    .select("id,name,email,kind,url,details,status,response,created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200)
    .overrideTypes<GrievanceRow[], { merge: false }>();
  if (!data?.length) return <p className="text-ink-soft">{t.admin.noGrievances}</p>;
  return (
    <ul className="space-y-3">
      {data.map((g) => {
        const overdue = g.status === "open" && hoursUntil(g.created_at) < -24;
        return (
          <li key={g.id} className={`card space-y-2 p-4 ${overdue ? "border-danger/50" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>
                <span className="chip bg-surface-2">{t.grievance.kinds[g.kind]}</span> <strong>{g.name}</strong>{" "}
                <a href={`mailto:${g.email}`} className="underline">{g.email}</a>
              </p>
              <span className={`chip ${overdue ? "bg-danger-soft text-danger" : "bg-surface-2"}`}>
                {g.status} · {formatDate(g.created_at, locale, true)}
              </span>
            </div>
            {g.url && <p className="text-xs break-all"><a href={g.url} className="underline" rel="noreferrer nofollow" target="_blank">{g.url}</a></p>}
            <p className="text-sm whitespace-pre-wrap">{g.details}</p>
            {g.response && <p className="rounded-xl bg-surface-2 p-3 text-sm">{g.response}</p>}
            {g.status !== "resolved" && <GrievanceActions id={g.id} status={g.status} />}
          </li>
        );
      })}
    </ul>
  );
}

type ActivityRow = {
  day: string;
  reports: number;
  confirmations: number;
  claims: number;
  fixes: number;
  comments: number;
  new_users: number;
  active_users: number;
  page_views: number;
};

async function Activity({ supabase, t }: { supabase: Supabase; t: Dictionary }) {
  const weekAgo = isoDaysAgo(7).slice(0, 10);
  const [{ data: rows }, { data: views }] = await Promise.all([
    supabase.rpc("admin_activity", { p_days: 30 }).then((r) => ({ ...r, data: r.data as ActivityRow[] | null })),
    supabase.from("page_views").select("path,views").gte("day", weekAgo),
  ]);
  const totals = new Map<string, number>();
  for (const v of views ?? []) totals.set(v.path, (totals.get(v.path) ?? 0) + v.views);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const cols = ["reports", "confirmations", "claims", "fixes", "comments", "new_users", "active_users", "page_views"] as const;
  const labels: Record<(typeof cols)[number], string> = {
    reports: t.admin.activity.reports,
    confirmations: t.admin.activity.confirmations,
    claims: t.admin.activity.claims,
    fixes: t.admin.activity.fixes,
    comments: t.admin.activity.comments,
    new_users: t.admin.activity.newUsers,
    active_users: t.admin.activity.activeUsers,
    page_views: t.admin.activity.pageViews,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="card overflow-x-auto">
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="border-b border-line text-xs text-ink-soft">
            <tr>
              <th className="p-2 text-left">{t.admin.activity.day}</th>
              {cols.map((c) => (
                <th key={c} className="p-2">{labels[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(rows ?? []).map((r) => (
              <tr key={r.day}>
                <td className="p-2 text-left whitespace-nowrap">{r.day}</td>
                {cols.map((c) => (
                  <td key={c} className={`p-2 ${r[c] ? "" : "text-ink-soft/50"}`}>{r[c]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card p-4">
        <h2 className="font-bold">{t.admin.topPages}</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {top.map(([path, n]) => (
            <li key={path} className="flex justify-between gap-2">
              <span className="truncate font-mono text-xs">{path}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

async function Log({ supabase, locale }: { supabase: Supabase; locale: Locale }) {
  const { data } = await supabase
    .from("moderation_log")
    .select("id,action,target_type,target_id,note,created_at,profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(100)
    .overrideTypes<{ id: string; action: string; target_type: string; target_id: string; note: string | null; created_at: string; profiles: { display_name: string } | null }[], { merge: false }>();
  return (
    <ul className="card divide-y divide-line text-sm">
      {(data ?? []).map((l) => (
        <li key={l.id} className="flex flex-wrap justify-between gap-2 p-3">
          <span>
            <strong>{l.profiles?.display_name ?? "–"}</strong> · {l.action} · {l.target_type}
            {l.note && <span className="text-ink-soft">: {l.note}</span>}
          </span>
          <span className="text-xs text-ink-soft">{formatDate(l.created_at, locale, true)}</span>
        </li>
      ))}
    </ul>
  );
}
