-- End-to-end rules test. Run with: npx supabase test db
-- Uses the seeded users (see seed.sql). Everything is rolled back afterwards.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Acting as a user: set the role and JWT claims the way PostgREST does.
-- Asha, Ravi, Meera, Imran from seed.sql. The problem sits at 12.9800, 77.6500.
-- 0.0009 degrees of latitude is ~100 m; 0.01 is ~1.1 km.

-- 1. Reporting: whatever the client sends, a report starts clean.
set local role authenticated; set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.problems (id, title, category, path, status, confirm_count, owner_id, lat, lng)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Test garbage pile', 'garbage', 'neighbours', 'verified', 99,
        '44444444-4444-4444-8444-444444444444', 12.9800, 77.6500);
reset role; reset request.jwt.claims;
select results_eq(
  $$ select status::text, confirm_count, owner_id, reporter_id from public.problems where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values ('reported', 0, null::uuid, '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'new reports are sanitized: status, counts, owner and reporter are server-controlled'
);

-- 2. Nobody can edit a problem directly.
set local role authenticated; set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
update public.problems set status = 'verified' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
reset role; reset request.jwt.claims;
select is((select status::text from public.problems where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'reported',
  'direct updates are blocked by RLS');

-- 3. Confirmation rules.
set local role authenticated; set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_like($$ select public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'exists', 12.9800, 77.6500) $$,
  '%cannot confirm their own%', 'reporters cannot confirm their own report');

set local role authenticated; set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_like($$ select public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'exists', 12.9900, 77.6500) $$,
  '%on the spot%', 'confirming from ~1 km away is rejected');
select is((public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'exists', 12.9809, 77.6500)).status::text, 'reported',
  'one confirmation from ~100 m is accepted but not enough');
select is((public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'exists', 12.9800, 77.6500)).confirm_count, 1,
  'confirming twice does not double count');

set local role authenticated; set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is((public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'exists', 12.9800, 77.6501)).status::text, 'confirmed',
  'second neighbour confirms the report');

-- 4. Claiming.
set local role authenticated; set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((public.claim_problem('aaaaaaaa-0000-4000-8000-000000000001', 3, 'Sunday cleanup')).status::text, 'claimed',
  'anyone can claim an unowned problem');

set local role authenticated; set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_like($$ select public.claim_problem('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '%already owns%', 'a second person cannot claim it');
select throws_like($$ select public.resolve_problem('aaaaaaaa-0000-4000-8000-000000000001', 'https://x/after.jpg') $$,
  '%Only the owner%', 'only the owner can mark it fixed');
select throws_like($$ select public.release_problem('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '%Only the current owner%', 'only the owner can release it');

-- 5. Resolving needs proof.
set local role authenticated; set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_like($$ select public.resolve_problem('aaaaaaaa-0000-4000-8000-000000000001', '') $$,
  '%photo is required%', 'resolving without an after photo is rejected');
select is((public.resolve_problem('aaaaaaaa-0000-4000-8000-000000000001', 'https://x/after.jpg', 'Done')).status::text, 'resolved',
  'owner posts the after photo');
select throws_like($$ select public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'fixed', 12.9800, 77.6500) $$,
  '%cannot verify their own fix%', 'the fixer cannot verify their own fix');

-- 6. Verification.
set local role authenticated; set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'fixed', 12.9800, 77.6500)).status::text, 'resolved',
  'one verification is not enough');
set local role authenticated; set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000001', 'fixed', 12.9800, 77.6500)).status::text, 'verified',
  'second neighbour (the reporter) verifies the fix');

reset role; reset request.jwt.claims;
select is((select reputation from public.profiles where id = '44444444-4444-4444-8444-444444444444'), 44 + 20,
  'the fixer earns reputation once verified');
select ok(exists(select 1 from public.notifications
                 where user_id = '11111111-1111-4111-8111-111111111111'
                   and problem_id = 'aaaaaaaa-0000-4000-8000-000000000001'
                   and body like 'Marked fixed%'),
  'the reporter was notified to verify');

-- 7. A fix neighbours reject reopens the problem.
set local role authenticated; set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.problems (id, title, category, path, lat, lng)
values ('aaaaaaaa-0000-4000-8000-000000000002', 'Test blocked drain', 'drain', 'neighbours', 12.9800, 77.6500);
set local role authenticated; set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select public.resolve_problem('aaaaaaaa-0000-4000-8000-000000000002', 'https://x/after.jpg');
set local role authenticated; set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000002', 'not_fixed', 12.9800, 77.6500);
set local role authenticated; set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((public.confirm_problem('aaaaaaaa-0000-4000-8000-000000000002', 'not_fixed', 12.9800, 77.6500)).status::text, 'reopened',
  'two "not fixed" votes reopen it');
reset role; reset request.jwt.claims;
select is((select owner_id from public.problems where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  '22222222-2222-4222-8222-222222222222'::uuid, 'whoever fixed an unclaimed problem became its owner');

-- 8. Switching paths.
set local role authenticated; set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_like($$ select public.change_path('aaaaaaaa-0000-4000-8000-000000000002', 'funding', 'need money') $$,
  '%reporter or the owner%', 'bystanders cannot switch the path');
set local role authenticated; set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((public.change_path('aaaaaaaa-0000-4000-8000-000000000002', 'funding', 'Needs a new grate')).path::text, 'funding',
  'the reporter can switch the path');

-- 9. Housekeeping releases silent claims.
reset role; reset request.jwt.claims;
update public.problems set last_activity_at = now() - interval '8 days' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select public.run_maintenance();
select results_eq(
  $$ select owner_id, status::text from public.problems where id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, 'reported') $$,
  'a claim silent for 7 days is released'
);

-- 10. Duplicate detection finds the open report nearby.
select ok(exists(select 1 from public.nearby_problems(12.9801, 77.6500, 150) where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'nearby_problems finds open reports within 150 m');

select * from finish();
rollback;
