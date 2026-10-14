// Shared vocabulary for problems. The enum values must match the Postgres enums
// and check constraints in supabase/migrations. Labels and copy live in the
// dictionaries (src/i18n/dictionaries), under `taxonomy`.

export const PATHS = {
  danger: { color: "#dc2626" },
  neighbours: { color: "#16a34a" },
  skill: { color: "#2563eb" },
  funding: { color: "#9333ea" },
  owner: { color: "#ea580c" },
  collective: { color: "#0891b2" },
} as const;

export type ProblemPath = keyof typeof PATHS;
export const PATH_KEYS = Object.keys(PATHS) as ProblemPath[];

export const CATEGORIES = {
  garbage: { path: "neighbours" },
  drain: { path: "neighbours" },
  water_leak: { path: "skill" },
  pothole: { path: "collective" },
  streetlight: { path: "collective" },
  electrical: { path: "danger" },
  tree: { path: "neighbours" },
  footpath: { path: "collective" },
  park: { path: "neighbours" },
  toilet: { path: "collective" },
  animal: { path: "skill" },
  construction: { path: "owner" },
  encroachment: { path: "owner" },
  noise: { path: "owner" },
  traffic: { path: "collective" },
  vandalism: { path: "neighbours" },
  fixture: { path: "skill" },
  other: { path: "neighbours" },
} as const satisfies Record<string, { path: ProblemPath }>;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const SKILL_KEYS = [
  "organizing",
  "labor",
  "transport",
  "writing",
  "fundraising",
  "media",
  "first_aid",
  "animal_care",
  "gardening",
  "general",
] as const;
export type Skill = (typeof SKILL_KEYS)[number];

export const SEVERITIES = {
  low: { color: "#64748b" },
  medium: { color: "#ca8a04" },
  high: { color: "#ea580c" },
  critical: { color: "#dc2626" },
} as const;

export type Severity = keyof typeof SEVERITIES;
export const SEVERITY_KEYS = Object.keys(SEVERITIES) as Severity[];

export const STATUSES = {
  reported: { color: "#64748b", step: 0 },
  confirmed: { color: "#ca8a04", step: 1 },
  claimed: { color: "#2563eb", step: 2 },
  reopened: { color: "#dc2626", step: 2 },
  resolved: { color: "#0891b2", step: 3 },
  verified: { color: "#16a34a", step: 4 },
  archived: { color: "#94a3b8", step: -1 },
} as const;

export type ProblemStatus = keyof typeof STATUSES;
export const OPEN_STATUSES: ProblemStatus[] = ["reported", "confirmed", "claimed", "reopened"];

export function isOpen(status: ProblemStatus) {
  return OPEN_STATUSES.includes(status);
}

// Must match public.rule() in the migrations.
export const RULES = {
  confirmThreshold: 2,
  verifyThreshold: 2,
  maxDistanceM: 300,
  claimDays: 7,
  freshPhotoMinutes: 20,
  autoHideFlags: 3,
} as const;

// India-wide emergency numbers, shown for anything on the danger path.
export const EMERGENCY_NUMBERS = [
  { key: "emergency", number: "112" },
  { key: "ambulance", number: "108" },
  { key: "fire", number: "101" },
  { key: "police", number: "100" },
] as const;

export const FLAG_REASONS = ["spam", "abusive", "private_info", "not_civic", "dangerous", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
