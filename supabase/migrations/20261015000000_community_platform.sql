-- Community platform: trust & safety, neighbourhoods, cleanup drives, push
-- notifications, and first-party analytics. All rules live here so every
-- client follows them.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tunables
-- ---------------------------------------------------------------------------

create or replace function public.rule(key text) returns numeric
language sql immutable as $$
  select case key
    when 'confirm_threshold'   then 2    -- weighted neighbour votes needed to confirm a report
    when 'dispute_threshold'   then 3    -- weighted "not real" votes needed to archive
    when 'verify_threshold'    then 2    -- weighted votes needed to verify a fix
    when 'reopen_threshold'    then 2    -- weighted "not fixed" votes needed to reopen
    when 'max_distance_m'      then 300  -- must be this close to confirm/verify
    when 'claim_days'          then 7    -- default claim deadline
    when 'stale_claim_days'    then 7    -- claim auto-released after this much silence
    when 'stale_report_days'   then 60   -- unconfirmed reports archived after this
    when 'fresh_photo_minutes' then 20   -- on-the-spot photos must be this recent
    when 'new_account_days'    then 3    -- votes from younger accounts count half
    when 'auto_hide_flags'     then 3    -- distinct flags that hide content pending review
  end
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, per user and bucket)
-- ---------------------------------------------------------------------------

create table private.rate_limits (
  user_id      uuid not null,
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (user_id, bucket, window_start)
);

create or replace function public.check_rate(p_bucket text, p_max integer, p_window interval)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  win timestamptz;
  n integer;
begin
  if uid is null then return; end if;
  win := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  insert into private.rate_limits (user_id, bucket, window_start, hits)
  values (uid, p_bucket, win, 1)
  on conflict (user_id, bucket, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into n;
  if n > p_max then
    raise exception 'You are doing that too often. Please try again later.' using errcode = '54000';
  end if;
end $$;

revoke execute on function public.check_rate(text, integer, interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Moderators and bans
-- ---------------------------------------------------------------------------

alter table public.profiles add column banned_at timestamptz;
alter table public.profiles add column ban_reason text check (char_length(ban_reason) <= 300);

-- Users can't edit these through the API (column grants only cover display_name, area).

create table public.moderators (
  user_id  uuid primary key references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
create policy "see own moderator row" on public.moderators for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators where user_id = auth.uid())
$$;

create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select banned_at is not null from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first' using errcode = '28000';
  end if;
  if public.is_banned() then
    raise exception 'Your account has been suspended. Contact the grievance officer if you think this is a mistake.'
      using errcode = '42501';
  end if;
  return auth.uid();
end $$;

-- Every moderation decision is recorded (IT Rules 2021 accountability).
create table public.moderation_log (
  id           uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles (id) on delete set null,
  action       text not null,
  target_type  text not null,
  target_id    uuid not null,
  note         text check (char_length(note) <= 1000),
  created_at   timestamptz not null default now()
);
alter table public.moderation_log enable row level security;
create policy "moderators read the log" on public.moderation_log for select to authenticated
  using (public.is_moderator());

-- ---------------------------------------------------------------------------
-- Problems: hiding, neighbourhoods, account deletion
-- ---------------------------------------------------------------------------

alter table public.problems add column hidden_at timestamptz;
alter table public.problems add column hidden_reason text check (char_length(hidden_reason) <= 300);
alter table public.problems add column locality text check (char_length(locality) <= 80);
alter table public.problems add column city text check (char_length(city) <= 80);
alter table public.problems add column locality_slug text generated always as (
  nullif(trim(both '-' from lower(regexp_replace(coalesce(locality, ''), '[^a-zA-Z0-9]+', '-', 'g'))), '')
) stored;
create index problems_locality_idx on public.problems (locality_slug, status);

alter table public.updates add column hidden_at timestamptz;

-- Deleting an account keeps the community record but drops the link to the person.
alter table public.problems alter column reporter_id drop not null;
alter table public.problems drop constraint problems_reporter_id_fkey;
alter table public.problems add constraint problems_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;

drop policy "problems are public" on public.problems;
create policy "problems are public" on public.problems for select
  using (hidden_at is null or reporter_id = (select auth.uid()) or (select public.is_moderator()));

drop policy "timeline is public" on public.updates;
create policy "timeline is public" on public.updates for select
  using (hidden_at is null or user_id = (select auth.uid()) or (select public.is_moderator()));

drop policy "signed-in users report" on public.problems;
create policy "signed-in users report" on public.problems for insert to authenticated
  with check (reporter_id = (select auth.uid()) and not (select public.is_banned()));

drop policy "comment as yourself" on public.updates;
create policy "comment as yourself" on public.updates for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'comment' and not (select public.is_banned()));

drop policy "support as yourself" on public.supports;
create policy "support as yourself" on public.supports for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()));

-- Reports: start clean; the client can't supply triage (guidance is computed server-side).
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
    new.ai_triage := null;
    new.hidden_at := null;
    new.hidden_reason := null;
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

-- Comments are rate limited.
create or replace function public.limit_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.kind = 'comment' and new.user_id = auth.uid() then
    perform public.check_rate('comment', 30, interval '1 hour');
  end if;
  return new;
end $$;
create trigger updates_rate_limit before insert on public.updates
  for each row execute function public.limit_comments();

create or replace function public.limit_supports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate('support', 60, interval '1 hour');
  return new;
end $$;
create trigger supports_rate_limit before insert on public.supports
  for each row execute function public.limit_supports();

-- Users can delete files in their own photo folder (needed for account deletion).
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- On-the-spot checks: fresh photo + new accounts count half
-- ---------------------------------------------------------------------------

-- True when the URL is a photo this user uploaded in the last few minutes.
create or replace function public.is_fresh_photo(url text, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_own_photo(url, owner) and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'photos'
      and o.name = substring(url from '/storage/v1/object/public/photos/(.+)$')
      and o.owner_id = owner::text
      and o.created_at > now() - make_interval(mins => public.rule('fresh_photo_minutes')::int)
  )
$$;

create or replace function public.vote_weight(p_user uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select case
    when created_at > now() - make_interval(days => public.rule('new_account_days')::int) then 0.5
    else 1
  end
  from public.profiles where id = p_user
$$;

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
  w_exists numeric;
  w_not_exists numeric;
  w_fixed numeric;
  w_not_fixed numeric;
begin
  select * into p from public.problems where id = p_problem for update;
  if not found or p.hidden_at is not null then raise exception 'Problem not found'; end if;

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

  -- Saying "it's there" or "it's fixed" needs a photo taken just now.
  if p_kind in ('exists', 'fixed') and not coalesce(public.is_fresh_photo(p_photo, uid), false) then
    raise exception 'Take a fresh photo on the spot to confirm (within % minutes)', public.rule('fresh_photo_minutes')
      using errcode = '22023';
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

  select
    coalesce(sum(public.vote_weight(user_id)) filter (where kind = 'exists'), 0),
    coalesce(sum(public.vote_weight(user_id)) filter (where kind = 'not_exists'), 0),
    coalesce(sum(public.vote_weight(user_id)) filter (where kind = 'fixed'), 0),
    coalesce(sum(public.vote_weight(user_id)) filter (where kind = 'not_fixed'), 0)
  into w_exists, w_not_exists, w_fixed, w_not_fixed
  from public.confirmations where problem_id = p.id;

  if changed_mind = 0 then
    update public.profiles set reputation = reputation + 1 where id = uid;
  end if;

  if p_kind in ('fixed', 'not_fixed') and coalesce(p_note, '') <> '' then
    insert into public.updates (problem_id, user_id, kind, body, photo_url)
    values (p.id, uid, 'comment', p_note, p_photo);
  end if;

  -- State transitions use weighted votes.
  if p.status = 'reported' and w_exists >= public.rule('confirm_threshold') then
    update public.problems set status = 'confirmed' where id = p.id returning * into p;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'status', 'Confirmed by ' || p.confirm_count || ' neighbours');

  elsif p.status in ('reported', 'confirmed')
        and w_not_exists >= public.rule('dispute_threshold')
        and w_not_exists > w_exists then
    update public.problems set status = 'archived' where id = p.id returning * into p;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'status', 'Archived: neighbours on the spot could not find this problem');

  elsif p.status = 'resolved' and w_fixed >= public.rule('verify_threshold') then
    update public.problems set status = 'verified', verified_at = now() where id = p.id returning * into p;
    update public.profiles set reputation = reputation + 20 where id = p.owner_id;
    update public.profiles set reputation = reputation + 5 where id = p.reporter_id;
    insert into public.updates (problem_id, kind, body)
    values (p.id, 'status', 'Verified fixed by ' || p.fixed_count || ' neighbours');

  elsif p.status = 'resolved' and w_not_fixed >= public.rule('reopen_threshold') then
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

-- ---------------------------------------------------------------------------
-- Flags, moderation and grievances
-- ---------------------------------------------------------------------------

create type public.flag_target as enum ('problem', 'update');
create type public.flag_reason as enum ('spam', 'abusive', 'private_info', 'not_civic', 'dangerous', 'other');

create table public.content_flags (
  id          uuid primary key default gen_random_uuid(),
  target_type public.flag_target not null,
  target_id   uuid not null,
  problem_id  uuid not null references public.problems (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  reason      public.flag_reason not null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution  text check (char_length(resolution) <= 300),
  unique (target_type, target_id, user_id)
);
create index content_flags_open_idx on public.content_flags (created_at) where resolved_at is null;
alter table public.content_flags enable row level security;
create policy "moderators and flaggers read flags" on public.content_flags for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create or replace function public.flag_content(
  p_type public.flag_target, p_id uuid, p_reason public.flag_reason, p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  pid uuid;
  flags integer;
begin
  perform public.check_rate('flag', 20, interval '1 hour');

  if p_type = 'problem' then
    select id into pid from public.problems where id = p_id;
  else
    select problem_id into pid from public.updates where id = p_id;
  end if;
  if pid is null then raise exception 'Not found'; end if;

  insert into public.content_flags (target_type, target_id, problem_id, user_id, reason, note)
  values (p_type, p_id, pid, uid, p_reason, nullif(trim(p_note), ''))
  on conflict (target_type, target_id, user_id) do update
    set reason = excluded.reason, note = excluded.note, created_at = now(), resolved_at = null;

  select count(*) into flags from public.content_flags
  where target_type = p_type and target_id = p_id and resolved_at is null;

  if flags = public.rule('auto_hide_flags') then
    if p_type = 'problem' then
      update public.problems set hidden_at = now(), hidden_reason = 'Hidden after community flags, pending review'
      where id = p_id and hidden_at is null;
    else
      update public.updates set hidden_at = now() where id = p_id and hidden_at is null;
    end if;
    insert into public.notifications (user_id, problem_id, body)
    select m.user_id, pid, 'Content hidden after ' || flags || ' flags, please review'
    from public.moderators m;
  end if;
end $$;

create or replace function public.moderate_content(
  p_type public.flag_target, p_id uuid, p_action text, p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  if p_action not in ('hide', 'restore', 'dismiss') then raise exception 'Unknown action'; end if;

  if p_action in ('hide', 'restore') then
    if p_type = 'problem' then
      update public.problems set
        hidden_at = case when p_action = 'hide' then now() end,
        hidden_reason = case when p_action = 'hide' then coalesce(nullif(trim(p_note), ''), 'Removed by a moderator') end
      where id = p_id;
    else
      update public.updates set hidden_at = case when p_action = 'hide' then now() end where id = p_id;
    end if;
  end if;

  update public.content_flags set resolved_at = now(), resolved_by = uid, resolution = p_action
  where target_type = p_type and target_id = p_id and resolved_at is null;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, note)
  values (uid, p_action, p_type::text, p_id, p_note);
end $$;

create or replace function public.set_user_ban(p_user uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  if p_user = uid then raise exception 'You cannot ban yourself'; end if;
  update public.profiles set
    banned_at = case when p_banned then now() end,
    ban_reason = case when p_banned then p_reason end
  where id = p_user;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, note)
  values (uid, case when p_banned then 'ban' else 'unban' end, 'user', p_user, p_reason);
end $$;

create table public.grievances (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles (id) on delete set null,
  name            text not null check (char_length(name) between 1 and 100),
  email           text not null check (char_length(email) between 3 and 200),
  kind            text not null check (kind in ('takedown', 'privacy', 'account', 'other')),
  url             text check (char_length(url) <= 500),
  details         text not null check (char_length(details) between 10 and 4000),
  status          text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  response        text check (char_length(response) <= 4000),
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz
);
alter table public.grievances enable row level security;
create policy "moderators read grievances" on public.grievances for select to authenticated
  using (public.is_moderator() or user_id = auth.uid());

-- Anyone can file a grievance (IT Rules 2021, rule 3(2)); signed-in users are rate limited.
create or replace function public.submit_grievance(
  p_name text, p_email text, p_kind text, p_url text, p_details text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
begin
  perform public.check_rate('grievance', 5, interval '1 day');
  if (select count(*) from public.grievances where created_at > now() - interval '1 minute') > 30 then
    raise exception 'Too many requests right now. Please email the grievance officer instead.' using errcode = '54000';
  end if;
  insert into public.grievances (user_id, name, email, kind, url, details)
  values (auth.uid(), trim(p_name), trim(p_email), p_kind, nullif(trim(p_url), ''), trim(p_details))
  returning id into gid;
  insert into public.notifications (user_id, body)
  select m.user_id, 'New grievance (' || p_kind || ') to acknowledge within 24 hours' from public.moderators m;
  return gid;
end $$;
grant execute on function public.submit_grievance(text, text, text, text, text) to anon, authenticated;

create or replace function public.update_grievance(p_id uuid, p_status text, p_response text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  update public.grievances set
    status = p_status,
    response = coalesce(nullif(trim(p_response), ''), response),
    acknowledged_at = coalesce(acknowledged_at, now()),
    resolved_at = case when p_status = 'resolved' then now() end
  where id = p_id;
  insert into public.moderation_log (moderator_id, action, target_type, target_id, note)
  values (uid, 'grievance_' || p_status, 'grievance', p_id, p_response);
end $$;

-- ---------------------------------------------------------------------------
-- Account deletion (DPDP Act 2023: right to erasure)
-- Photos are removed by the client through the Storage API first.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  -- Problems and timeline entries stay as community record, without the name.
  update public.problems set owner_id = null, claimed_at = null, due_at = null,
    status = case when status in ('claimed', 'reopened')
                  then case when confirm_count >= public.rule('confirm_threshold') then 'confirmed'::public.problem_status
                            else 'reported'::public.problem_status end
                  else status end
  where owner_id = uid;
  delete from auth.users where id = uid;
end $$;

-- ---------------------------------------------------------------------------
-- Cleanup drives
-- ---------------------------------------------------------------------------

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  problem_id    uuid not null references public.problems (id) on delete cascade,
  organizer_id  uuid references public.profiles (id) on delete set null,
  starts_at     timestamptz not null,
  meeting_point text not null check (char_length(meeting_point) between 2 and 200),
  checklist     text[] not null default '{}' check (cardinality(checklist) <= 12),
  notes         text check (char_length(notes) <= 1000),
  status        text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  rsvp_count    integer not null default 0,
  reminded_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index events_problem_idx on public.events (problem_id, starts_at);
create index events_upcoming_idx on public.events (starts_at) where status = 'planned';

create table public.event_rsvps (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
create policy "events are public" on public.events for select using (true);
create policy "rsvps are public" on public.event_rsvps for select using (true);
create policy "rsvp as yourself" on public.event_rsvps for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned()
              and exists (select 1 from public.events e where e.id = event_id and e.status = 'planned'));
create policy "cancel own rsvp" on public.event_rsvps for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.sync_rsvp_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events set rsvp_count = (select count(*) from public.event_rsvps where event_id = eid) where id = eid;
  return null;
end $$;
create trigger event_rsvps_count after insert or delete on public.event_rsvps
  for each row execute function public.sync_rsvp_count();

create or replace function public.create_event(
  p_problem uuid, p_starts_at timestamptz, p_meeting_point text, p_checklist text[], p_notes text default null
) returns public.events
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  p public.problems;
  e public.events;
  items text[];
begin
  perform public.check_rate('event', 5, interval '1 day');
  select * into p from public.problems where id = p_problem;
  if not found or p.hidden_at is not null then raise exception 'Problem not found'; end if;
  if p.status not in ('reported', 'confirmed', 'claimed', 'reopened') then
    raise exception 'Drives can only be planned for open problems';
  end if;
  if p.path = 'danger' then
    raise exception 'Dangerous problems need emergency services, not a volunteer drive';
  end if;
  if p_starts_at < now() or p_starts_at > now() + interval '90 days' then
    raise exception 'Pick a time in the next 90 days';
  end if;

  select coalesce(array_agg(left(trim(i), 80)), '{}') into items
  from unnest(coalesce(p_checklist, '{}')) as i where trim(i) <> '';

  insert into public.events (problem_id, organizer_id, starts_at, meeting_point, checklist, notes)
  values (p.id, uid, p_starts_at, trim(p_meeting_point), items[1:12], nullif(trim(p_notes), ''))
  returning * into e;

  insert into public.event_rsvps (event_id, user_id) values (e.id, uid);

  insert into public.updates (problem_id, user_id, kind, body, meta)
  values (p.id, uid, 'system', 'Planned a cleanup drive', jsonb_build_object('event_id', e.id, 'starts_at', e.starts_at));

  -- Supporters are the people most likely to turn up.
  insert into public.notifications (user_id, problem_id, body)
  select s.user_id, p.id, 'Cleanup drive planned for: ' || p.title
  from public.supports s
  where s.problem_id = p.id and s.user_id <> uid;

  select * into e from public.events where id = e.id;
  return e;
end $$;

create or replace function public.set_event_status(p_event uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  e public.events;
begin
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'Drive not found'; end if;
  if e.organizer_id is distinct from uid then raise exception 'Only the organizer can change this drive'; end if;
  if p_status not in ('done', 'cancelled') then raise exception 'Unknown status'; end if;
  update public.events set status = p_status where id = e.id;

  insert into public.notifications (user_id, problem_id, body)
  select r.user_id, e.problem_id,
         case p_status when 'done' then 'Cleanup drive done. Thank you! Post the after photo if it is fixed.'
                       else 'Cleanup drive cancelled' end
  from public.event_rsvps r where r.event_id = e.id and r.user_id <> uid;
end $$;

-- ---------------------------------------------------------------------------
-- Neighbourhood pages and impact dashboard
-- ---------------------------------------------------------------------------

create or replace function public.area_stats()
returns table (
  slug text, locality text, city text, reported bigint, open bigint, fixed bigint,
  fixed_this_month bigint, median_days_to_fix numeric, fix_rate numeric
)
language sql stable security definer set search_path = '' as $$
  select
    p.locality_slug,
    mode() within group (order by p.locality),
    mode() within group (order by p.city),
    count(*),
    count(*) filter (where p.status in ('reported', 'confirmed', 'claimed', 'reopened')),
    count(*) filter (where p.status = 'verified'),
    count(*) filter (where p.status = 'verified' and p.verified_at >= date_trunc('month', now())),
    round((percentile_cont(0.5) within group (order by extract(epoch from p.verified_at - p.created_at) / 86400)
           filter (where p.status = 'verified'))::numeric, 1),
    round(100.0 * count(*) filter (where p.status = 'verified') / nullif(count(*) filter (where p.status <> 'archived'), 0), 0)
  from public.problems p
  where p.locality_slug is not null and p.hidden_at is null
  group by p.locality_slug
  order by count(*) desc
  limit 200
$$;

create or replace function public.area_leaderboard(p_slug text)
returns table (display_name text, fixes bigint, confirmations bigint, reputation integer)
language sql stable security definer set search_path = '' as $$
  with area as (
    select id, owner_id, status from public.problems where locality_slug = p_slug and hidden_at is null
  ),
  fixes as (
    select owner_id as uid, count(*) as n from area where status = 'verified' and owner_id is not null group by owner_id
  ),
  checks as (
    select c.user_id as uid, count(*) as n from public.confirmations c join area a on a.id = c.problem_id group by c.user_id
  )
  select pr.display_name, coalesce(f.n, 0), coalesce(c.n, 0), pr.reputation
  from public.profiles pr
  left join fixes f on f.uid = pr.id
  left join checks c on c.uid = pr.id
  where (f.n is not null or c.n is not null) and pr.banned_at is null
  order by coalesce(f.n, 0) desc, coalesce(c.n, 0) desc, pr.reputation desc
  limit 10
$$;

create or replace function public.public_stats()
returns table (reported bigint, open bigint, in_progress bigint, verified bigint, helpers bigint, median_days_to_fix numeric)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.problems where hidden_at is null),
    (select count(*) from public.problems where hidden_at is null and status in ('reported', 'confirmed', 'reopened')),
    (select count(*) from public.problems where hidden_at is null and status in ('claimed', 'resolved')),
    (select count(*) from public.problems where hidden_at is null and status = 'verified'),
    (select count(*) from public.helpers where available),
    (select round((percentile_cont(0.5) within group (order by extract(epoch from verified_at - created_at) / 86400))::numeric, 1)
       from public.problems where hidden_at is null and status = 'verified')
$$;

-- ---------------------------------------------------------------------------
-- Web push (free: VAPID). Notifications are forwarded to the app's /api/push
-- endpoint with pg_net. Configure with:
--   insert into private.settings values
--     ('push_webhook_url', 'https://your-domain/api/push'),
--     ('push_webhook_secret', '<same as PUSH_WEBHOOK_SECRET>');
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

create table private.settings (
  key   text primary key,
  value text not null
);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function private.dispatch_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  hook text := (select value from private.settings where key = 'push_webhook_url');
  secret text := (select value from private.settings where key = 'push_webhook_secret');
  subs jsonb;
begin
  if hook is null or secret is null then return null; end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)))
  into subs from public.push_subscriptions where user_id = new.user_id;
  if subs is null then return null; end if;

  perform net.http_post(
    url := hook,
    body := jsonb_build_object(
      'title', 'Sambhal',
      'body', new.body,
      'url', case when new.problem_id is not null then '/problems/' || new.problem_id else '/me' end,
      'subscriptions', subs
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret)
  );
  return null;
exception when others then
  -- Push is best effort; never block the notification itself.
  raise warning 'push dispatch failed: %', sqlerrm;
  return null;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function private.dispatch_push();

-- Called by /api/push to drop subscriptions the browser has revoked.
create or replace function public.prune_push_subscription(p_endpoint text, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select value from private.settings where key = 'push_webhook_secret') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end $$;
grant execute on function public.prune_push_subscription(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- First-party analytics: daily page view counts, no personal data.
-- ---------------------------------------------------------------------------

create table public.page_views (
  day   date not null,
  path  text not null check (char_length(path) <= 100),
  views integer not null default 0,
  primary key (day, path)
);
alter table public.page_views enable row level security;
create policy "moderators read page views" on public.page_views for select to authenticated
  using (public.is_moderator());

create or replace function public.track_view(p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  clean text := left(regexp_replace(split_part(coalesce(p_path, '/'), '?', 1),
                     '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'g'), 100);
begin
  if clean !~ '^/[a-zA-Z0-9/:_-]*$' then return; end if;
  insert into public.page_views (day, path, views) values (current_date, clean, 1)
  on conflict (day, path) do update set views = public.page_views.views + 1;
end $$;
grant execute on function public.track_view(text) to anon, authenticated;

-- Product activity per day, derived from what people actually do.
create or replace function public.admin_activity(p_days integer default 30)
returns table (
  day date, reports bigint, confirmations bigint, claims bigint, fixes bigint,
  comments bigint, new_users bigint, active_users bigint, page_views bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  return query
  with days as (
    select generate_series(current_date - (least(p_days, 180) - 1), current_date, interval '1 day')::date as d
  ),
  actors as (
    select created_at::date as d, reporter_id as uid from public.problems
    union all select created_at::date, user_id from public.confirmations
    union all select created_at::date, user_id from public.updates where user_id is not null
    union all select created_at::date, user_id from public.supports
  )
  select
    days.d,
    (select count(*) from public.problems where created_at::date = days.d),
    (select count(*) from public.confirmations where created_at::date = days.d),
    (select count(*) from public.updates where kind = 'claim' and created_at::date = days.d),
    (select count(*) from public.problems where verified_at::date = days.d),
    (select count(*) from public.updates where kind = 'comment' and created_at::date = days.d),
    (select count(*) from public.profiles where created_at::date = days.d),
    (select count(distinct uid) from actors where actors.d = days.d),
    (select coalesce(sum(views), 0) from public.page_views where page_views.day = days.d)
  from days
  order by days.d desc;
end $$;

-- ---------------------------------------------------------------------------
-- Housekeeping: also send cleanup-drive reminders and prune rate-limit rows
-- ---------------------------------------------------------------------------

create or replace function public.run_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
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

  update public.problems set status = 'archived'
  where status = 'reported' and confirm_count = 0
    and created_at < now() - make_interval(days => public.rule('stale_report_days')::int);

  -- Remind people a day before a cleanup drive.
  for r in
    select e.id, e.problem_id, e.starts_at, e.meeting_point from public.events e
    where e.status = 'planned' and e.reminded_at is null
      and e.starts_at between now() and now() + interval '24 hours'
  loop
    insert into public.notifications (user_id, problem_id, body)
    select v.user_id, r.problem_id, 'Reminder: cleanup drive tomorrow at ' || r.meeting_point
    from public.event_rsvps v where v.event_id = r.id;
    update public.events set reminded_at = now() where id = r.id;
  end loop;

  delete from private.rate_limits where window_start < now() - interval '2 days';
  delete from public.notifications where created_at < now() - interval '1 year';
end $$;

revoke execute on function public.run_maintenance() from public, anon, authenticated;
revoke execute on function public.admin_activity(integer) from anon;
revoke execute on function public.delete_my_account() from anon;
