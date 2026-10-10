-- Sambhal: report any civic problem, and the community finds a way to deal with it.
-- No officials, no admins. Status changes come from residents (confirmations,
-- claims, before/after proof, and neighbour verification), enforced here in the
-- database so every client follows the same rules.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Who can deal with a problem. See src/lib/taxonomy.ts for labels and copy.
create type public.problem_path as enum (
  'danger',      -- immediate risk: warn people, call emergency services, no DIY
  'neighbours',  -- volunteers can fix it themselves
  'skill',       -- needs someone with a trade skill
  'funding',     -- needs money or materials pooled
  'owner',       -- a private owner (shop, builder, society) must act
  'collective'   -- only the state can fix it: build public, collective pressure
);

create type public.problem_status as enum (
  'reported',   -- posted, awaiting neighbour confirmation
  'confirmed',  -- neighbours confirmed it is real
  'claimed',    -- someone owns it and is working on it
  'resolved',   -- owner posted "after" proof, awaiting verification
  'verified',   -- neighbours verified the fix
  'reopened',   -- verification failed; back to work
  'archived'    -- stale or disputed as not real
);

create type public.problem_severity as enum ('low', 'medium', 'high', 'critical');

create type public.confirmation_kind as enum ('exists', 'not_exists', 'fixed', 'not_fixed');

create type public.update_kind as enum (
  'comment', 'status', 'claim', 'release', 'resolution', 'path_change', 'reopen', 'system'
);

-- ---------------------------------------------------------------------------
-- Tunables (one place, so the UI copy and the rules can't drift apart)
-- ---------------------------------------------------------------------------

create or replace function public.rule(key text) returns numeric
language sql immutable as $$
  select case key
    when 'confirm_threshold'   then 2    -- neighbours needed to confirm a report
    when 'dispute_threshold'   then 3    -- "not real" votes needed to archive
    when 'verify_threshold'    then 2    -- neighbours needed to verify a fix
    when 'reopen_threshold'    then 2    -- "not fixed" votes needed to reopen
    when 'max_distance_m'      then 300  -- must be this close to confirm/verify
    when 'claim_days'          then 7    -- default claim deadline
    when 'stale_claim_days'    then 7    -- claim auto-released after this much silence
    when 'stale_report_days'   then 60   -- unconfirmed reports archived after this
  end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Neighbour' check (char_length(display_name) between 1 and 60),
  area         text check (char_length(area) <= 80),
  reputation   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.helpers (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  skills     text[] not null default '{}',
  radius_km  integer not null default 3 check (radius_km between 1 and 50),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  location   extensions.geography(Point, 4326),
  available  boolean not null default true,
  bio        text check (char_length(bio) <= 280),
  updated_at timestamptz not null default now()
);

create table public.problems (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 4 and 120),
  description      text not null default '' check (char_length(description) <= 2000),
  category         text not null,
  severity         public.problem_severity not null default 'medium',
  path             public.problem_path not null,
  status           public.problem_status not null default 'reported',
  lat              double precision not null check (lat between -90 and 90),
  lng              double precision not null check (lng between -180 and 180),
  location         extensions.geography(Point, 4326) not null,
  address          text check (char_length(address) <= 200),
  photos           text[] not null default '{}',
  skills_needed    text[] not null default '{}',
  ai_triage        jsonb,
  owner_id         uuid references public.profiles (id) on delete set null,
  claimed_at       timestamptz,
  due_at           timestamptz,
  confirm_count    integer not null default 0,
  dispute_count    integer not null default 0,
  support_count    integer not null default 0,
  fixed_count      integer not null default 0,
  not_fixed_count  integer not null default 0,
  resolved_at      timestamptz,
  verified_at      timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index problems_location_idx on public.problems using gist (location);
create index problems_status_idx on public.problems (status, created_at desc);
create index problems_lat_lng_idx on public.problems (lat, lng);
create index problems_owner_idx on public.problems (owner_id);
create index problems_reporter_idx on public.problems (reporter_id);
create index helpers_location_idx on public.helpers using gist (location);

create table public.confirmations (
  id          uuid primary key default gen_random_uuid(),
  problem_id  uuid not null references public.problems (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.confirmation_kind not null,
  photo_url   text,
  distance_m  integer not null,
  note        text check (char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  unique (problem_id, user_id, kind)
);

create table public.updates (
  id          uuid primary key default gen_random_uuid(),
  problem_id  uuid not null references public.problems (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  kind        public.update_kind not null default 'comment',
  body        text not null default '' check (char_length(body) <= 2000),
  photo_url   text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index updates_problem_idx on public.updates (problem_id, created_at);

create table public.supports (
  problem_id uuid not null references public.problems (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (problem_id, user_id)
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  problem_id  uuid references public.problems (id) on delete cascade,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Every new auth user gets a profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Neighbour'), '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the geography column in sync with lat/lng.
create or replace function public.set_location() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.location := extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography;
  return new;
end $$;

create trigger problems_set_location before insert or update of lat, lng on public.problems
  for each row execute function public.set_location();
create trigger helpers_set_location before insert or update of lat, lng on public.helpers
  for each row execute function public.set_location();

-- Reports created through the API always start clean, whatever the client sends.
create or replace function public.sanitize_new_problem() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
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

create trigger problems_sanitize before insert on public.problems
  for each row execute function public.sanitize_new_problem();

-- Opening timeline entry + alert nearby helpers whose skills match.
create or replace function public.after_new_problem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.updates (problem_id, user_id, kind, body)
  values (new.id, new.reporter_id, 'status', 'Reported');

  if cardinality(new.skills_needed) > 0 then
    insert into public.notifications (user_id, problem_id, body)
    select h.user_id, new.id, 'A problem near you needs your skills: ' || new.title
    from public.helpers h
    where h.available
      and h.user_id <> new.reporter_id
      and h.skills && new.skills_needed
      and extensions.st_dwithin(h.location, new.location, h.radius_km * 1000);
  end if;
  return new;
end $$;

create trigger problems_after_insert after insert on public.problems
  for each row execute function public.after_new_problem();

-- Any timeline activity keeps the problem "alive" and notifies the people involved.
create or replace function public.after_new_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.problems;
begin
  update public.problems set last_activity_at = now() where id = new.problem_id
  returning * into p;

  if new.kind <> 'status' or new.body <> 'Reported' then
    insert into public.notifications (user_id, problem_id, body)
    select distinct u, p.id,
      case new.kind
        when 'comment' then 'New comment on: '
        when 'claim' then 'Someone took ownership of: '
        when 'release' then 'Needs a new owner: '
        when 'resolution' then 'Marked fixed, please verify: '
        when 'reopen' then 'Reopened: '
        else 'Update on: '
      end || p.title
    from unnest(array[p.reporter_id, p.owner_id]) as u
    where u is not null and u is distinct from new.user_id;
  end if;
  return new;
end $$;

create trigger updates_after_insert after insert on public.updates
  for each row execute function public.after_new_update();

-- Support ("me too") counter.
create or replace function public.sync_support_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := coalesce(new.problem_id, old.problem_id);
begin
  update public.problems
  set support_count = (select count(*) from public.supports where problem_id = pid)
  where id = pid;
  return null;
end $$;

create trigger supports_count after insert or delete on public.supports
  for each row execute function public.sync_support_count();

-- ---------------------------------------------------------------------------
-- Actions (the only way to change a problem's state)
-- ---------------------------------------------------------------------------

create or replace function public.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

-- Confirm a report is real / not real, or verify a fix / say it isn't fixed.
-- Must be made on-site: the caller's position has to be within max_distance_m.
create or replace function public.confirm_problem(
  p_problem uuid,
  p_kind public.confirmation_kind,
  p_lat double precision,
  p_lng double precision,
  p_photo text default null,
  p_note text default null
) returns public.problems
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  p public.problems;
  dist integer;
  changed_mind integer;
begin
  select * into p from public.problems where id = p_problem for update;
  if not found then raise exception 'Problem not found'; end if;

  dist := round(extensions.st_distance(
    p.location,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  ));
  if dist > public.rule('max_distance_m') then
    raise exception 'You need to be on the spot to do this (you are % m away, max % m)', dist, public.rule('max_distance_m');
  end if;

  if p_kind in ('exists', 'not_exists') then
    if p.status not in ('reported', 'confirmed', 'claimed', 'reopened') then
      raise exception 'This problem is not open for confirmation';
    end if;
    if uid = p.reporter_id then
      raise exception 'Reporters cannot confirm their own report';
    end if;
    delete from public.confirmations
    where problem_id = p.id and user_id = uid and kind in ('exists', 'not_exists');
    get diagnostics changed_mind = row_count;
  else
    if p.status <> 'resolved' then
      raise exception 'There is no fix waiting for verification';
    end if;
    if uid = p.owner_id then
      raise exception 'The person who fixed it cannot verify their own fix';
    end if;
    delete from public.confirmations
    where problem_id = p.id and user_id = uid and kind in ('fixed', 'not_fixed');
    get diagnostics changed_mind = row_count;
  end if;

  insert into public.confirmations (problem_id, user_id, kind, photo_url, distance_m, note)
  values (p.id, uid, p_kind, p_photo, dist, p_note);

  update public.problems set
    confirm_count   = (select count(*) from public.confirmations where problem_id = p.id and kind = 'exists'),
    dispute_count   = (select count(*) from public.confirmations where problem_id = p.id and kind = 'not_exists'),
    fixed_count     = (select count(*) from public.confirmations where problem_id = p.id and kind = 'fixed'),
    not_fixed_count = (select count(*) from public.confirmations where problem_id = p.id and kind = 'not_fixed')
  where id = p.id
  returning * into p;

  if changed_mind = 0 then
    update public.profiles set reputation = reputation + 1 where id = uid;
  end if;

  if p_kind in ('fixed', 'not_fixed') and coalesce(p_note, '') <> '' then
    insert into public.updates (problem_id, user_id, kind, body, photo_url)
    values (p.id, uid, 'comment', p_note, p_photo);
  end if;

  -- State transitions
  if p.status = 'reported' and p.confirm_count >= public.rule('confirm_threshold') then
    update public.problems set status = 'confirmed' where id = p.id returning * into p;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'status', 'Confirmed by ' || p.confirm_count || ' neighbours');

  elsif p.status in ('reported', 'confirmed')
        and p.dispute_count >= public.rule('dispute_threshold')
        and p.dispute_count > p.confirm_count then
    update public.problems set status = 'archived' where id = p.id returning * into p;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'status', 'Archived: neighbours on the spot could not find this problem');

  elsif p.status = 'resolved' and p.fixed_count >= public.rule('verify_threshold') then
    update public.problems set status = 'verified', verified_at = now() where id = p.id returning * into p;
    update public.profiles set reputation = reputation + 20 where id = p.owner_id;
    update public.profiles set reputation = reputation + 5 where id = p.reporter_id;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'status', 'Verified fixed by ' || p.fixed_count || ' neighbours');

  elsif p.status = 'resolved' and p.not_fixed_count >= public.rule('reopen_threshold') then
    delete from public.confirmations where problem_id = p.id and kind in ('fixed', 'not_fixed');
    update public.problems set
      status = 'reopened', resolved_at = null, fixed_count = 0, not_fixed_count = 0,
      due_at = now() + make_interval(days => public.rule('claim_days')::int)
    where id = p.id returning * into p;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'reopen', 'Reopened: neighbours say it is not fixed yet');
  end if;

  return p;
end $$;

-- Take ownership of a problem.
create or replace function public.claim_problem(p_problem uuid, p_days integer default null, p_note text default null)
returns public.problems
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  p public.problems;
  days integer := least(greatest(coalesce(p_days, public.rule('claim_days')::int), 1), 60);
begin
  select * into p from public.problems where id = p_problem for update;
  if not found then raise exception 'Problem not found'; end if;
  if p.owner_id is not null then raise exception 'Someone already owns this problem'; end if;
  if p.status not in ('reported', 'confirmed', 'reopened') then
    raise exception 'This problem cannot be claimed right now';
  end if;

  update public.problems set
    owner_id = uid, claimed_at = now(), due_at = now() + make_interval(days => days), status = 'claimed'
  where id = p.id returning * into p;

  insert into public.updates (problem_id, user_id, kind, body, meta)
  values (p.id, uid, 'claim', coalesce(nullif(p_note, ''), 'I''ll take this on'), jsonb_build_object('days', days));
  return p;
end $$;

-- Give up ownership so someone else can take it.
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

  update public.problems set
    owner_id = null, claimed_at = null, due_at = null,
    status = case when confirm_count >= public.rule('confirm_threshold') then 'confirmed'::public.problem_status
                  else 'reported'::public.problem_status end
  where id = p.id returning * into p;

  insert into public.updates (problem_id, user_id, kind, body)
  values (p.id, uid, 'release', coalesce(nullif(p_note, ''), 'Released, needs a new owner'));
  return p;
end $$;

-- Post "after" proof. The owner does this; if nobody owns it, whoever fixed it becomes the owner.
create or replace function public.resolve_problem(p_problem uuid, p_photo text, p_note text default null)
returns public.problems
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  p public.problems;
begin
  if coalesce(p_photo, '') = '' then raise exception 'An "after" photo is required'; end if;

  select * into p from public.problems where id = p_problem for update;
  if not found then raise exception 'Problem not found'; end if;
  if p.status not in ('reported', 'confirmed', 'claimed', 'reopened') then
    raise exception 'This problem cannot be marked fixed right now';
  end if;
  if p.owner_id is not null and p.owner_id <> uid then
    raise exception 'Only the owner can mark this fixed';
  end if;

  delete from public.confirmations where problem_id = p.id and kind in ('fixed', 'not_fixed');
  update public.problems set
    owner_id = uid, claimed_at = coalesce(claimed_at, now()), status = 'resolved', resolved_at = now(),
    fixed_count = 0, not_fixed_count = 0
  where id = p.id returning * into p;

  insert into public.updates (problem_id, user_id, kind, body, photo_url)
  values (p.id, uid, 'resolution', coalesce(nullif(p_note, ''), 'Fixed. Neighbours, please verify.'), p_photo);
  return p;
end $$;

-- Switch to a different path when the current one is stuck.
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
  if p.path = p_path then return p; end if;

  old_path := p.path;
  update public.problems set path = p_path where id = p.id returning * into p;
  insert into public.updates (problem_id, user_id, kind, body, meta)
  values (p.id, uid, 'path_change', p_reason, jsonb_build_object('from', old_path, 'to', p_path));
  return p;
end $$;

-- ---------------------------------------------------------------------------
-- Read helpers
-- ---------------------------------------------------------------------------

-- Open problems close to a point, for "is this already reported?".
create or replace function public.nearby_problems(p_lat double precision, p_lng double precision, p_radius_m integer default 150)
returns table (id uuid, title text, category text, status public.problem_status, photo text, distance_m integer)
language sql stable set search_path = '' as $$
  select p.id, p.title, p.category, p.status, p.photos[1],
         round(extensions.st_distance(p.location, pt))::int
  from public.problems p,
       lateral (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as pt) q
  where p.status not in ('verified', 'archived')
    and extensions.st_dwithin(p.location, q.pt, least(p_radius_m, 2000))
  order by 6
  limit 5
$$;

-- Helpers who could take a "needs a skill" problem. Exact helper locations stay private.
create or replace function public.helpers_for_problem(p_problem uuid)
returns table (display_name text, skills text[], distance_km numeric, reputation integer)
language sql stable security definer set search_path = '' as $$
  select pr.display_name, h.skills,
         round((extensions.st_distance(h.location, p.location) / 1000)::numeric, 1),
         pr.reputation
  from public.problems p
  join public.helpers h on h.available and extensions.st_dwithin(h.location, p.location, h.radius_km * 1000)
  join public.profiles pr on pr.id = h.user_id
  where p.id = p_problem
    and (cardinality(p.skills_needed) = 0 or h.skills && p.skills_needed)
  order by 3
  limit 20
$$;

create or replace function public.public_stats()
returns table (reported bigint, open bigint, in_progress bigint, verified bigint, helpers bigint, median_days_to_fix numeric)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.problems),
    (select count(*) from public.problems where status in ('reported', 'confirmed', 'reopened')),
    (select count(*) from public.problems where status in ('claimed', 'resolved')),
    (select count(*) from public.problems where status = 'verified'),
    (select count(*) from public.helpers where available),
    (select round((percentile_cont(0.5) within group (order by extract(epoch from verified_at - created_at) / 86400))::numeric, 1)
       from public.problems where status = 'verified')
$$;

-- ---------------------------------------------------------------------------
-- Housekeeping: nothing rots silently
-- ---------------------------------------------------------------------------

create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  -- Owners who go quiet lose the claim, so someone else can pick it up.
  for r in
    select id from public.problems
    where status in ('claimed', 'reopened') and owner_id is not null
      and last_activity_at < now() - make_interval(days => public.rule('stale_claim_days')::int)
  loop
    update public.problems set
      owner_id = null, claimed_at = null, due_at = null,
      status = case when confirm_count >= public.rule('confirm_threshold') then 'confirmed'::public.problem_status
                    else 'reported'::public.problem_status end
    where id = r.id;
    insert into public.updates (problem_id, kind, body)
    values (r.id, 'release', 'No update for ' || public.rule('stale_claim_days') || ' days, so this is open for a new owner');
  end loop;

  -- Reports nobody could confirm fade out.
  update public.problems set status = 'archived'
  where status = 'reported' and confirm_count = 0
    and created_at < now() - make_interval(days => public.rule('stale_report_days')::int);
end $$;

-- Run housekeeping hourly where pg_cron is available (it is on Supabase).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('sambhal-maintenance', '0 * * * *', 'select public.run_maintenance()');
exception when others then
  raise notice 'pg_cron not available; call public.run_maintenance() on a schedule yourself';
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.helpers enable row level security;
alter table public.problems enable row level security;
alter table public.confirmations enable row level security;
alter table public.updates enable row level security;
alter table public.supports enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own helper profile" on public.helpers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "problems are public" on public.problems for select using (true);
create policy "signed-in users report" on public.problems for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "confirmations are public" on public.confirmations for select using (true);

create policy "timeline is public" on public.updates for select using (true);
create policy "comment as yourself" on public.updates for insert to authenticated
  with check (user_id = auth.uid() and kind = 'comment');

create policy "supports are public" on public.supports for select using (true);
create policy "support as yourself" on public.supports for insert to authenticated
  with check (user_id = auth.uid());
create policy "withdraw own support" on public.supports for delete to authenticated
  using (user_id = auth.uid());

create policy "own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Internal helpers are not part of the public API.
revoke execute on function public.run_maintenance() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Only the column users may edit on their own profile.
revoke update on public.profiles from authenticated;
grant update (display_name, area) on public.profiles to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: public read, users write only inside their own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
