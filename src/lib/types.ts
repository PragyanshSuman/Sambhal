import type { Category, ProblemPath, ProblemStatus, Severity, Skill } from "./taxonomy";

export type Triage = {
  is_civic_problem: boolean;
  title: string;
  category: Category;
  severity: Severity;
  path: ProblemPath;
  path_reason: string;
  skills_needed: Skill[];
  first_steps: string[];
  safety_notes: string[];
  source: "ai" | "rules";
};

export type Problem = {
  id: string;
  reporter_id: string;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  path: ProblemPath;
  status: ProblemStatus;
  lat: number;
  lng: number;
  address: string | null;
  photos: string[];
  skills_needed: Skill[];
  ai_triage: Triage | null;
  owner_id: string | null;
  claimed_at: string | null;
  due_at: string | null;
  confirm_count: number;
  dispute_count: number;
  support_count: number;
  fixed_count: number;
  not_fixed_count: number;
  resolved_at: string | null;
  verified_at: string | null;
  last_activity_at: string;
  created_at: string;
};

/** Columns needed for map pins and list cards. */
export const PROBLEM_CARD_COLUMNS =
  "id,title,category,severity,path,status,lat,lng,address,photos,confirm_count,support_count,created_at" as const;

export type ProblemCard = Pick<
  Problem,
  | "id"
  | "title"
  | "category"
  | "severity"
  | "path"
  | "status"
  | "lat"
  | "lng"
  | "address"
  | "photos"
  | "confirm_count"
  | "support_count"
  | "created_at"
>;

export type Profile = {
  id: string;
  display_name: string;
  area: string | null;
  reputation: number;
};

export type TimelineEntry = {
  id: string;
  kind: "comment" | "status" | "claim" | "release" | "resolution" | "path_change" | "reopen" | "system";
  body: string;
  photo_url: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
  profiles: { display_name: string } | null;
};
