import { CATEGORIES, PATHS, SEVERITIES, STATUSES, type Category, type ProblemPath, type ProblemStatus, type Severity } from "@/lib/taxonomy";

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span 
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase shadow-sm border backdrop-blur-md" 
      style={{ 
        color, 
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProblemStatus }) {
  const s = STATUSES[status];
  return <Chip color={s.color}>{s.label}</Chip>;
}

export function PathBadge({ path }: { path: ProblemPath }) {
  return <Chip color={PATHS[path].color}>{PATHS[path].short}</Chip>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  if (severity === "low" || severity === "medium") return null;
  return <Chip color={SEVERITIES[severity].color}>{SEVERITIES[severity].label}</Chip>;
}

export function categoryLabel(category: string) {
  return CATEGORIES[category as Category]?.label ?? category;
}
