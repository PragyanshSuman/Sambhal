import type { LegalSection } from "@/content/legal";

export function LegalPage({ title, updated, sections, children }: { title: string; updated: string; sections: LegalSection[]; children?: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{updated}</p>
      {sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-lg font-bold">{s.heading}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
            {s.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      {children}
    </article>
  );
}
