"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { STATUSES, type ProblemStatus } from "@/lib/taxonomy";

export function StatusStepper({ status }: { status: ProblemStatus }) {
  const { t } = useI18n();
  const current = STATUSES[status].step;
  if (current < 0) {
    return <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-soft">{t.problem.archived}</p>;
  }
  const steps = t.problem.steps;
  return (
    <ol className="flex items-center gap-1" aria-label={t.problem.progress}>
      {steps.map((label, i) => {
        const done = i < current || status === "verified";
        const active = i === current && status !== "verified";
        return (
          <li key={i} className="flex flex-1 flex-col items-center gap-1 text-center">
            <span className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "invisible" : done || active ? "bg-brand" : "bg-line"}`} />
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-brand text-brand-ink"
                    : active
                      ? status === "reopened"
                        ? "bg-danger text-white"
                        : "bg-accent text-white"
                      : "bg-surface-2 text-ink-soft"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "invisible" : done ? "bg-brand" : "bg-line"}`} />
            </span>
            <span className={`text-[11px] leading-tight ${active ? "font-semibold text-ink" : "text-ink-soft"}`}>
              {active && status === "reopened" ? t.taxonomy.statuses.reopened : label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
