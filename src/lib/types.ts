import type { Category, ProblemPath, ProblemStatus, Severity, Skill } from "./taxonomy";

export type Problem = {
  id: string;
  reporter_id: string | null;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  path: ProblemPath;
  status: ProblemStatus;
  lat: number;
  lng: number;
  address: string | null;
  locality: string | null;
  city: string | null;
  locality_slug: string | null;
  photos: string[];
  skills_needed: Skill[];
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
  hidden_at: string | null;
  hidden_reason: string | null;
  last_activity_at: string;
  created_at: string;
};

/** Columns needed for map pins and list cards. */
export const PROBLEM_CARD_COLUMNS =
  "id,title,category,severity,path,status,lat,lng,address,locality,photos,confirm_count,support_count,created_at" as const;

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
  | "locality"
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
  banned_at?: string | null;
};

export type TimelineEntry = {
  id: string;
  kind: "comment" | "status" | "claim" | "release" | "resolution" | "path_change" | "reopen" | "system";
  body: string;
  photo_url: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
  hidden_at: string | null;
  profiles: { display_name: string } | null;
};

export type DriveEvent = {
  id: string;
  problem_id: string;
  organizer_id: string | null;
  starts_at: string;
  meeting_point: string;
  checklist: string[];
  notes: string | null;
  status: "planned" | "done" | "cancelled";
  rsvp_count: number;
  profiles: { display_name: string } | null;
  event_rsvps: { user_id: string; profiles: { display_name: string } | null }[];
};

export type AreaStats = {
  slug: string;
  locality: string;
  city: string | null;
  reported: number;
  open: number;
  fixed: number;
  fixed_this_month: number;
  median_days_to_fix: number | null;
  fix_rate: number | null;
};
