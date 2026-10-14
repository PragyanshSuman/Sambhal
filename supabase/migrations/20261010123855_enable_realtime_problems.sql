-- Enable Supabase Realtime for the problems table so the map updates on the go.
-- Idempotent: databases created before this migration existed may already have it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'problems'
  ) then
    alter publication supabase_realtime add table public.problems;
  end if;
end $$;
