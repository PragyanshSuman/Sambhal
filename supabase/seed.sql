-- Demo data for local development: a few neighbours in Indiranagar, Bengaluru,
-- and problems at every stage of the flow. Sign in as any of these emails with
-- the 6-digit code from the local mail viewer (http://127.0.0.1:54324).

do $$
declare
  asha  uuid := '11111111-1111-4111-8111-111111111111';
  ravi  uuid := '22222222-2222-4222-8222-222222222222';
  meera uuid := '33333333-3333-4333-8333-333333333333';
  imran uuid := '44444444-4444-4444-8444-444444444444';
  u record;
  p_garbage uuid := gen_random_uuid();
  p_leak    uuid := gen_random_uuid();
  p_pothole uuid := gen_random_uuid();
  p_wire    uuid := gen_random_uuid();
  p_bench   uuid := gen_random_uuid();
  p_debris  uuid := gen_random_uuid();
begin
  for u in
    select * from (values
      (asha,  'asha@example.com',  'Asha'),
      (ravi,  'ravi@example.com',  'Ravi'),
      (meera, 'meera@example.com', 'Meera'),
      (imran, 'imran@example.com', 'Imran')
    ) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
  end loop;

  -- Established accounts, so their on-the-spot votes count fully.
  update public.profiles set created_at = now() - interval '90 days';
  insert into public.moderators (user_id) values (asha);

  update public.profiles set area = 'Indiranagar', reputation = 12 where id = asha;
  update public.profiles set area = 'HAL 2nd Stage', reputation = 31 where id = ravi;
  update public.profiles set area = 'Indiranagar', reputation = 5 where id = meera;
  update public.profiles set area = 'Domlur', reputation = 44 where id = imran;

  insert into public.helpers (user_id, skills, radius_km, lat, lng, bio)
  values
    (imran, '{general,first_aid}', 5, 12.9690, 77.6400, 'Trained first-aider, free most evenings'),
    (ravi, '{labor,organizing}', 3, 12.9730, 77.6430, 'Retired, handy with tools, happy to rally people');

  insert into public.problems
    (id, reporter_id, title, description, category, severity, path, status, lat, lng, address,
     confirm_count, support_count, owner_id, claimed_at, due_at, created_at, last_activity_at)
  values
    (p_garbage, asha, 'Garbage dumped at corner of 12th Main',
     'Mixed waste piling up for two weeks. Dogs are tearing the bags open and the smell reaches the school gate.',
     'garbage', 'medium', 'neighbours', 'claimed', 12.97150, 77.64120, 'Near the bus stop, 12th Main',
     3, 9, ravi, now() - interval '1 day', now() + interval '5 days', now() - interval '6 days', now() - interval '1 day'),
    (p_leak, meera, 'Community tap leaking all day',
     'The public tap near the temple has a broken valve and water runs constantly.',
     'water_leak', 'medium', 'skill', 'confirmed', 12.97320, 77.63890, 'Next to Ganesh temple',
     2, 4, null, null, null, now() - interval '3 days', now() - interval '2 days'),
    (p_pothole, ravi, 'Deep pothole on 100 Feet Road service lane',
     'Two scooters have already skidded here after rain.',
     'pothole', 'high', 'collective', 'confirmed', 12.97010, 77.64480, '100 Feet Road service lane',
     5, 23, null, null, null, now() - interval '21 days', now() - interval '4 days'),
    (p_wire, imran, 'Exposed wire hanging from streetlight pole',
     'Cable hanging at head height, sparks seen during rain last night.',
     'electrical', 'critical', 'danger', 'reported', 12.96880, 77.63990, 'Pole outside house no. 422',
     1, 6, null, null, null, now() - interval '5 hours', now() - interval '5 hours'),
    (p_bench, asha, 'Broken bench in Defence Colony park',
     'One plank snapped, the bench is unusable for the elderly morning walkers.',
     'fixture', 'low', 'neighbours', 'verified', 12.97480, 77.64260, 'Defence Colony park, east gate',
     2, 7, ravi, now() - interval '12 days', now() - interval '5 days', now() - interval '14 days', now() - interval '8 days'),
    (p_debris, meera, 'Construction debris blocking the footpath',
     'Bricks and sand from a renovation have blocked the footpath for a week, so people walk on the road.',
     'construction', 'medium', 'owner', 'reported', 12.97230, 77.64650, 'Opposite the pharmacy, 80 Feet Road',
     0, 2, null, null, null, now() - interval '2 days', now() - interval '2 days');

  update public.problems set skills_needed = '{general}' where id = p_leak;
  update public.problems set locality = 'Indiranagar', city = 'Bengaluru'
  where id in (p_garbage, p_leak, p_pothole, p_bench);
  update public.problems set locality = 'HAL 2nd Stage', city = 'Bengaluru' where id in (p_wire, p_debris);

  insert into public.events (problem_id, organizer_id, starts_at, meeting_point, checklist, notes)
  values (p_garbage, ravi, date_trunc('day', now()) + interval '3 days 8 hours', 'Bus stop, 12th Main',
          '{Gloves,"Garbage bags",Broom,"Water bottle"}', 'Two hours, then chai on the corner.');
  insert into public.event_rsvps (event_id, user_id)
  select e.id, who from public.events e, unnest(array[ravi, meera, asha]) as who where e.problem_id = p_garbage;
  update public.problems set resolved_at = now() - interval '9 days', verified_at = now() - interval '8 days', fixed_count = 2
  where id = p_bench;

  insert into public.updates (problem_id, user_id, kind, body, created_at) values
    (p_garbage, null, 'status', 'Confirmed by 3 neighbours', now() - interval '5 days'),
    (p_garbage, ravi, 'claim', 'Cleanup drive this Sunday 8am. Bring gloves; I''ll get bags and a broom.', now() - interval '1 day'),
    (p_garbage, meera, 'comment', 'I can bring 3 more people from our building.', now() - interval '20 hours'),
    (p_leak, null, 'status', 'Confirmed by 2 neighbours', now() - interval '2 days'),
    (p_pothole, null, 'status', 'Confirmed by 5 neighbours', now() - interval '19 days'),
    (p_pothole, asha, 'comment', 'Shared on the ward WhatsApp group. Planning to file an RTI if nothing moves in 10 days.', now() - interval '4 days'),
    (p_bench, ravi, 'claim', 'I have spare planks, will fix it this weekend.', now() - interval '12 days'),
    (p_bench, ravi, 'resolution', 'Replaced the plank and sanded it. Thanks Asha for the screws!', now() - interval '9 days'),
    (p_bench, null, 'status', 'Verified fixed by 2 neighbours', now() - interval '8 days');
end $$;
