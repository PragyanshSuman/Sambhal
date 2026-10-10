// Shared vocabulary for problems. The enum values must match the Postgres enums
// in supabase/migrations; the labels and copy are what residents see.

export const PATHS = {
  danger: {
    label: "Danger first",
    short: "Danger",
    color: "#dc2626",
    who: "Emergency services, plus peers warning others",
    blurb: "Immediate risk to people. Warn others, keep away, and call emergency services. No DIY.",
  },
  neighbours: {
    label: "Peers can fix it",
    short: "Peers",
    color: "#16a34a",
    who: "Volunteers / Peers",
    blurb: "Safe for residents to fix together: clean, clear, paint, plant, repair.",
  },
  skill: {
    label: "Needs a skill",
    short: "Skill",
    color: "#2563eb",
    who: "Skilled peers nearby",
    blurb: "Needs specific capability: organizing, heavy lifting, or transport.",
  },
  funding: {
    label: "Needs money or materials",
    short: "Funding",
    color: "#9333ea",
    who: "Peers and local shops pledging",
    blurb: "Fixable once someone covers materials: a bin, a bulb, a ramp, some paint.",
  },
  owner: {
    label: "Needs the owner",
    short: "Owner",
    color: "#ea580c",
    who: "A private owner: a shop, builder, society or landlord",
    blurb: "Someone specific is responsible. Reach out politely, with evidence.",
  },
  collective: {
    label: "Collective ask",
    short: "Collective",
    color: "#0891b2",
    who: "Everyone affected, together",
    blurb: "Only public works can fix it. Build public evidence and a shared voice.",
  },
} as const;

export type ProblemPath = keyof typeof PATHS;
export const PATH_KEYS = Object.keys(PATHS) as ProblemPath[];

export const CATEGORIES = {
  garbage: { label: "Garbage / dumping", path: "neighbours" },
  drain: { label: "Blocked drain", path: "neighbours" },
  water_leak: { label: "Water leak", path: "skill" },
  pothole: { label: "Pothole / road damage", path: "collective" },
  streetlight: { label: "Streetlight out", path: "collective" },
  electrical: { label: "Exposed wire / electrical hazard", path: "danger" },
  tree: { label: "Fallen or dangerous tree", path: "neighbours" },
  footpath: { label: "Broken footpath", path: "collective" },
  park: { label: "Park / public space", path: "neighbours" },
  toilet: { label: "Public toilet", path: "collective" },
  animal: { label: "Animal in distress", path: "skill" },
  construction: { label: "Construction debris / hazard", path: "owner" },
  encroachment: { label: "Encroachment / blocked way", path: "owner" },
  noise: { label: "Noise / pollution", path: "owner" },
  traffic: { label: "Traffic / signage", path: "collective" },
  vandalism: { label: "Vandalism / graffiti", path: "neighbours" },
  fixture: { label: "Broken bench, gate or fixture", path: "skill" },
  other: { label: "Something else", path: "neighbours" },
} as const satisfies Record<string, { label: string; path: ProblemPath }>;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const SKILLS = {
  organizing: "Organizing / rallying",
  labor: "Physical labor / lifting",
  transport: "Transport / vehicle",
  writing: "Writing / RTI drafting",
  fundraising: "Fundraising",
  media: "Photography / social media",
  first_aid: "First aid",
  animal_care: "Animal care",
  gardening: "Cleaning / greening",
  general: "General help",
} as const;

export type Skill = keyof typeof SKILLS;
export const SKILL_KEYS = Object.keys(SKILLS) as Skill[];

export const SEVERITIES = {
  low: { label: "Low", color: "#64748b" },
  medium: { label: "Medium", color: "#ca8a04" },
  high: { label: "High", color: "#ea580c" },
  critical: { label: "Critical", color: "#dc2626" },
} as const;

export type Severity = keyof typeof SEVERITIES;
export const SEVERITY_KEYS = Object.keys(SEVERITIES) as Severity[];

export const STATUSES = {
  reported: { label: "Reported", color: "#64748b", step: 0 },
  confirmed: { label: "Confirmed", color: "#ca8a04", step: 1 },
  claimed: { label: "Being handled", color: "#2563eb", step: 2 },
  reopened: { label: "Reopened", color: "#dc2626", step: 2 },
  resolved: { label: "Fixed, verifying", color: "#0891b2", step: 3 },
  verified: { label: "Verified fixed", color: "#16a34a", step: 4 },
  archived: { label: "Archived", color: "#94a3b8", step: -1 },
} as const;

export type ProblemStatus = keyof typeof STATUSES;
export const OPEN_STATUSES: ProblemStatus[] = ["reported", "confirmed", "claimed", "reopened"];

// Must match public.rule() in the migration.
export const RULES = {
  confirmThreshold: 2,
  verifyThreshold: 2,
  maxDistanceM: 300,
  claimDays: 7,
} as const;

// India-wide emergency numbers, shown for anything on the danger path.
export const EMERGENCY_NUMBERS = [
  { label: "Emergency", number: "112" },
  { label: "Ambulance", number: "108" },
  { label: "Fire", number: "101" },
  { label: "Police", number: "100" },
] as const;
