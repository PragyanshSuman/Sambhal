-- Hardening. Clients write to problems/updates/helpers directly through the API,
-- so everything they send is validated here, not just in the UI:
--   * category and skills must come from src/lib/taxonomy.ts
--   * photo URLs must point at the uploader's own folder in the photos bucket
--     (otherwise any URL, including tracking pixels or javascript:, would be rendered)
--   * reports are rate-limited per user
-- Also closes two state-machine gaps: releasing or re-pathing a problem that is
-- already resolved/verified/archived.

-- ---------------------------------------------------------------------------
-- Taxonomy: keep in sync with CATEGORIES and SKILLS in src/lib/taxonomy.ts
-- ---------------------------------------------------------------------------

-- Skills were renamed in the app (trades like plumber/electrician were dropped).
-- Map anything unknown to 'general' so existing helpers keep getting alerts.
create or replace function public.normalize_skills(skills text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct s order by s), '{}')
  from (
    select case
      when x in ('organizing', 'labor', 'transport', 'writing', 'fundraising',
                 'media', 'first_aid', 'animal_care', 'gardening', 'general') then x
      when x in ('carpenter', 'welder', 'mason', 'painter') then 'labor'
      else 'general'
    end as s
    from unnest(skills) as x
  ) t
$$;

update public.helpers set skills = public.normalize_skills(skills)
where skills is distinct from public.normalize_skills(skills);
update public.problems set skills_needed = public.normalize_skills(skills_needed)
where skills_needed is distinct from public.normalize_skills(skills_needed);

drop function public.normalize_skills(text[]);

alter table public.helpers add constraint helpers_skills_valid check (
  skills <@ array['organizing', 'labor', 'transport', 'writing', 'fundraising',
                  'media', 'first_aid', 'animal_care', 'gardening', 'general']::text[]
);
alter table public.problems add constraint problems_skills_valid check (
  skills_needed <@ array['organizing', 'labor', 'transport', 'writing', 'fundraising',
                         'media', 'first_aid', 'animal_care', 'gardening', 'general']::text[]
);

update public.problems set category = 'other'
where category not in ('garbage', 'drain', 'water_leak', 'pothole', 'streetlight', 'electrical',
                       'tree', 'footpath', 'park', 'toilet', 'animal', 'construction',
                       'encroachment', 'noise', 'traffic', 'vandalism', 'fixture', 'other');

alter table public.problems add constraint problems_category_valid check (
  category in ('garbage', 'drain', 'water_leak', 'pothole', 'streetlight', 'electrical',
               'tree', 'footpath', 'park', 'toilet', 'animal', 'construction',
               'encroachment', 'noise', 'traffic', 'vandalism', 'fixture', 'other')
);

alter table public.problems add constraint problems_photos_max check (cardinality(photos) <= 3);
-- ai_triage is a small object written by the reporter's client; cap it so it can't be abused as storage.
alter table public.problems add constraint problems_ai_triage_shape check (
  ai_triage is null or (jsonb_typeof(ai_triage) = 'object' and octet_length(ai_triage::text) <= 8192)
);

-- ---------------------------------------------------------------------------
-- Photos: only files the user uploaded to their own folder (see src/lib/upload.ts)
-- ---------------------------------------------------------------------------

create or replace function public.is_own_photo(url text, owner uuid) returns boolean
language sql immutable set search_path = '' as $$
  select url ~ ('^https?://[^/?#]+/storage/v1/object/public/photos/' || owner::text || '/[A-Za-z0-9._-]+$')
$$;

-- Applies to every write made with a user's JWT, including through the
-- security-definer actions (auth.uid() still identifies the caller there).
create or replace function public.check_photo_url() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and new.photo_url is not null
     and not public.is_own_photo(new.photo_url, auth.uid()) then
    raise exception 'Photos must be uploaded through Sambhal' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger updates_check_photo before insert on public.updates
  for each row execute function public.check_photo_url();
create trigger confirmations_check_photo before insert on public.confirmations
  for each row execute function public.check_photo_url();

-- ---------------------------------------------------------------------------
-- New reports: start clean (as before), plus photo and rate-limit checks
-- ---------------------------------------------------------------------------

create or replace function public.sanitize_new_problem() returns trigger
language plpgsql set search_path = '' as $$
declare
  photo text;
begin
  if auth.uid() is not null then
    foreach photo in array new.photos loop
      if not public.is_own_photo(photo, auth.uid()) then
        raise exception 'Photos must be uploaded through Sambhal' using errcode = '22023';
      end if;
    end loop;

    if (select count(*) from public.problems
        where reporter_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'You have posted a lot of reports in the last hour. Please try again later.'
        using errcode = '54000';
    end if;

    new.reporter_id := auth.uid();
    new.status := 'reported';
    new.owner_id := null;
    new.claimed_at := null;
    new.due_at := null;
    new.confirm_count := 0;
    new.dispute_count := 0;
    new.support_count := 0;
    new.fixed_count := 0;
    new.not_fixed_count := 0;
    new.resolved_at := null;
    new.verified_at := null;
    new.created_at := now();
    new.last_activity_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- State machine fixes
-- ---------------------------------------------------------------------------

-- Releasing used to work in any status, so the owner of a verified fix could
-- "release" it back to confirmed. Only an active claim can be released.
create or replace function public.release_problem(p_problem uuid, p_note text default null)
returns public.problems
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  p public.problems;
begin
  select * into p from public.problems where id = p_problem for update;
  if not found then raise exception 'Problem not found'; end if;
  if p.owner_id is distinct from uid then raise exception 'Only the current owner can release this'; end if;
  if p.status not in ('claimed', 'reopened') then
    raise exception 'This problem cannot be released right now';
  end if;

  update public.problems set
    owner_id = null, claimed_at = null, due_at = null,
    status = case when confirm_count >= public.rule('confirm_threshold') then 'confirmed'::public.problem_status
                  else 'reported'::public.problem_status end
  where id = p.id returning * into p;

  insert into public.updates (problem_id, user_id, kind, body)
  values (p.id, uid, 'release', coalesce(nullif(p_note, ''), 'Released, needs a new owner'));
  return p;
end $$;

-- Closed problems keep the path they were resolved under.
create or replace function public.change_path(p_problem uuid, p_path public.problem_path, p_reason text)
returns public.problems
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  p public.problems;
  old_path public.problem_path;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please say why the path should change'; end if;

  select * into p from public.problems where id = p_problem for update;
  if not found then raise exception 'Problem not found'; end if;
  if uid not in (p.reporter_id, coalesce(p.owner_id, p.reporter_id)) then
    raise exception 'Only the reporter or the owner can change the path';
  end if;
  if p.status not in ('reported', 'confirmed', 'claimed', 'reopened') then
    raise exception 'The path can only change while the problem is open';
  end if;
  if p.path = p_path then return p; end if;

  old_path := p.path;
  update public.problems set path = p_path where id = p.id returning * into p;
  insert into public.updates (problem_id, user_id, kind, body, meta)
  values (p.id, uid, 'path_change', left(p_reason, 300), jsonb_build_object('from', old_path, 'to', p_path));
  return p;
end $$;
