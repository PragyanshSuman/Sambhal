"use client";

import { useI18n } from "@/i18n/client";
import { PATHS, SEVERITIES, STATUSES, type Category, type ProblemPath, type ProblemStatus, type Severity } from "@/lib/taxonomy";

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase shadow-sm backdrop-blur-md"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProblemStatus }) {
  const { t } = useI18n();
  return <Chip color={STATUSES[status].color}>{t.taxonomy.statuses[status]}</Chip>;
}

export function PathBadge({ path }: { path: ProblemPath }) {
  const { t } = useI18n();
  return <Chip color={PATHS[path].color}>{t.taxonomy.paths[path].short}</Chip>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useI18n();
  if (severity === "low" || severity === "medium") return null;
  return <Chip color={SEVERITIES[severity].color}>{t.taxonomy.severities[severity]}</Chip>;
}

export function CategoryLabel({ category }: { category: string }) {
  const { t } = useI18n();
  return <>{t.taxonomy.categories[category as Category] ?? category}</>;
}
