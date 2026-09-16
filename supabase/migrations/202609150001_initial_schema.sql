create extension if not exists pgcrypto;

create type public.election_status as enum ('draft', 'scheduled', 'open', 'closed', 'published', 'archived');
create type public.age_group as enum ('teens', 'young_people', 'young_adults');

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  ballot_slug text not null unique,
  title text not null,
  description text not null default '',
  election_date date,
  timezone text not null default 'Asia/Manila',
  opens_at timestamptz,
  closes_at timestamptz,
  status public.election_status not null default 'draft',
  instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint election_window_valid check (opens_at is null or closes_at is null or closes_at > opens_at)
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  name text not null,
  group_scope text not null check (group_scope in ('general', 'teens', 'young_people', 'young_adults')),
  description text not null default '',
  responsibilities jsonb not null default '[]'::jsonb,
  display_order integer not null,
  abstain_enabled boolean not null default false,
  unique (election_id, display_order)
);

create table public.nominees (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions(id) on delete cascade,
  full_name text not null,
  image_url text,
  short_profile text,
  age_group text check (age_group is null or age_group in ('teens', 'young_people', 'young_adults')),
  display_order integer not null,
  active boolean not null default true,
  unique (position_id, display_order)
);

-- These tables are in the API schema so server-side code can query them, but RLS
-- intentionally grants no browser role access. The service role is used only in
-- Next.js route handlers.
create table public.eligible_voters (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  member_id text not null,
  member_id_normalized text not null,
  first_name text not null,
  last_name text not null,
  last_name_normalized text not null,
  gender text,
  age integer check (age is null or age between 0 and 120),
  birth_date date,
  age_group public.age_group not null,
  eligible boolean not null default true,
  imported_at timestamptz not null default now(),
  unique (election_id, member_id_normalized)
);

create table public.participation (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  eligible_voter_id uuid not null references public.eligible_voters(id) on delete restrict,
  verified_at timestamptz,
  submitted_at timestamptz,
  unique (election_id, eligible_voter_id)
);

create table public.anonymous_ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete restrict,
  submitted_at timestamptz not null default now()
);

create table public.ballot_selections (
  id uuid primary key default gen_random_uuid(),
  anonymous_ballot_id uuid not null references public.anonymous_ballots(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete restrict,
  nominee_id uuid references public.nominees(id) on delete restrict,
  is_abstain boolean not null default false,
  unique (anonymous_ballot_id, position_id),
  constraint selection_exactly_one check ((nominee_id is not null) <> is_abstain)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  election_id uuid references public.elections(id) on delete set null,
  action text not null,
  affected_record_type text,
  affected_record_id uuid,
  change_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.verification_attempts (
  client_key_hash text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.elections enable row level security;
alter table public.positions enable row level security;
alter table public.nominees enable row level security;
alter table public.eligible_voters enable row level security;
alter table public.participation enable row level security;
alter table public.anonymous_ballots enable row level security;
alter table public.ballot_selections enable row level security;
alter table public.audit_events enable row level security;
alter table public.verification_attempts enable row level security;

create policy "active elections are publicly readable" on public.elections for select to anon
  using (status in ('open', 'closed', 'published'));
create policy "active positions are publicly readable" on public.positions for select to anon
  using (exists (select 1 from public.elections where elections.id = positions.election_id and elections.status in ('open', 'closed', 'published')));
create policy "active nominees are publicly readable" on public.nominees for select to anon
  using (exists (select 1 from public.positions join public.elections on elections.id = positions.election_id where positions.id = nominees.position_id and elections.status in ('open', 'closed', 'published')));

create or replace function public.sync_election(p_election jsonb, p_voters jsonb default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_election_id uuid := (p_election->>'id')::uuid;
  v_position jsonb;
  v_nominee jsonb;
  v_voter jsonb;
  v_position_ids uuid[] := '{}';
  v_nominee_ids uuid[] := '{}';
  v_status public.election_status := lower(p_election->>'status')::public.election_status;
  v_group text;
  v_name_parts text[];
begin
  insert into public.elections (id, ballot_slug, title, description, election_date, opens_at, closes_at, status, updated_at)
  values (
    v_election_id, p_election->>'ballotSlug', p_election->>'title', coalesce(p_election->>'description', ''),
    nullif(p_election->>'electionDate', '')::date, nullif(p_election->>'opensAt', '')::timestamptz,
    nullif(p_election->>'closesAt', '')::timestamptz, v_status, now()
  )
  on conflict (id) do update set ballot_slug = excluded.ballot_slug, title = excluded.title,
    description = excluded.description, election_date = excluded.election_date, opens_at = excluded.opens_at,
    closes_at = excluded.closes_at, status = excluded.status, updated_at = now();

  for v_position in select value from jsonb_array_elements(coalesce(p_election->'positions', '[]'::jsonb)) as item(value)
  loop
    v_position_ids := array_append(v_position_ids, (v_position->>'id')::uuid);
    v_group := case v_position->>'group' when 'Young People' then 'young_people' when 'Young Adults' then 'young_adults' else lower(v_position->>'group') end;
    insert into public.positions (id, election_id, name, group_scope, description, responsibilities, display_order, abstain_enabled)
    values ((v_position->>'id')::uuid, v_election_id, v_position->>'name', v_group, coalesce(v_position->>'description', ''), coalesce(v_position->'responsibilities', '[]'::jsonb),
      (select ordinality from jsonb_array_elements(p_election->'positions') with ordinality x(value, ordinality) where x.value->>'id' = v_position->>'id' limit 1),
      coalesce((v_position->>'abstainEnabled')::boolean, false))
    on conflict (id) do update set name = excluded.name, group_scope = excluded.group_scope, description = excluded.description,
      responsibilities = excluded.responsibilities, display_order = excluded.display_order, abstain_enabled = excluded.abstain_enabled;

    v_nominee_ids := '{}';
    for v_nominee in select * from jsonb_array_elements(coalesce(v_position->'nominees', '[]'::jsonb))
    loop
      v_nominee_ids := array_append(v_nominee_ids, (v_nominee->>'id')::uuid);
      insert into public.nominees (id, position_id, full_name, image_url, short_profile, age_group, display_order, active)
      values ((v_nominee->>'id')::uuid, (v_position->>'id')::uuid, v_nominee->>'name', nullif(v_nominee->>'imageUrl', ''), v_nominee->>'profile',
        case coalesce(v_nominee->>'ageGroup', '') when 'Young People' then 'young_people' when 'Young Adults' then 'young_adults' when 'Teens' then 'teens' else null end,
        (select ordinality from jsonb_array_elements(v_position->'nominees') with ordinality x(value, ordinality) where x.value->>'id' = v_nominee->>'id' limit 1), true)
      on conflict (id) do update set full_name = excluded.full_name, image_url = excluded.image_url, short_profile = excluded.short_profile,
        age_group = excluded.age_group, display_order = excluded.display_order, active = true;
    end loop;
    delete from public.nominees where position_id = (v_position->>'id')::uuid and not (id = any(v_nominee_ids));
  end loop;
  delete from public.positions where election_id = v_election_id and not (id = any(v_position_ids));

  if p_voters is not null then
    update public.eligible_voters set eligible = false where election_id = v_election_id;
    for v_voter in select * from jsonb_array_elements(p_voters)
    loop
      v_name_parts := regexp_split_to_array(trim(v_voter->>'name'), '\\s+');
      v_group := case v_voter->>'ageGroup' when 'Young People' then 'young_people' when 'Young Adults' then 'young_adults' else 'teens' end;
      insert into public.eligible_voters (election_id, member_id, member_id_normalized, first_name, last_name, last_name_normalized, gender, age, birth_date, age_group, eligible)
      values (v_election_id, v_voter->>'memberId', upper(trim(v_voter->>'memberId')),
        coalesce(nullif(v_voter->>'firstName', ''), array_to_string(v_name_parts[1:array_length(v_name_parts, 1)-1], ' ')),
        coalesce(nullif(v_voter->>'lastName', ''), v_name_parts[array_length(v_name_parts, 1)]),
        lower(trim(coalesce(nullif(v_voter->>'lastName', ''), v_name_parts[array_length(v_name_parts, 1)]))),
        nullif(v_voter->>'gender', ''), nullif(v_voter->>'age', '')::integer, nullif(v_voter->>'birthDate', '')::date, v_group::public.age_group, true)
      on conflict (election_id, member_id_normalized) do update set first_name = excluded.first_name, last_name = excluded.last_name,
        last_name_normalized = excluded.last_name_normalized, gender = excluded.gender, age = excluded.age,
        birth_date = excluded.birth_date, age_group = excluded.age_group, eligible = true, imported_at = now();
    end loop;
  elsif p_election ? 'eligibleVoterIds' then
    update public.eligible_voters set eligible = member_id = any(array(select jsonb_array_elements_text(p_election->'eligibleVoterIds'))) where election_id = v_election_id;
  end if;

  insert into public.audit_events (election_id, action, affected_record_type, affected_record_id, change_summary)
  values (v_election_id, 'election_saved', 'election', v_election_id, jsonb_build_object('title', p_election->>'title', 'status', p_election->>'status'));
  return v_election_id;
end;
$$;

create or replace function public.submit_ballot(p_election_id uuid, p_voter_id uuid, p_selections jsonb)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  v_ballot_id uuid;
  v_submitted_at timestamptz := now();
  v_position public.positions%rowtype;
  v_choice text;
  v_expected_count integer;
begin
  if not exists (select 1 from public.elections where id = p_election_id and status = 'open' and opens_at <= now() and closes_at >= now()) then
    raise exception 'This election is not open for voting.';
  end if;
  if not exists (select 1 from public.eligible_voters where id = p_voter_id and election_id = p_election_id and eligible) then
    raise exception 'This voter is not eligible for the election.';
  end if;
  if exists (select 1 from public.participation where election_id = p_election_id and eligible_voter_id = p_voter_id and submitted_at is not null) then
    raise exception 'A ballot has already been submitted for this voter.';
  end if;

  select count(*) into v_expected_count from public.positions p
  join public.eligible_voters v on v.id = p_voter_id
  where p.election_id = p_election_id and (p.group_scope = 'general' or p.group_scope = v.age_group::text);
  if (select count(*) from jsonb_object_keys(p_selections)) <> v_expected_count then
    raise exception 'The ballot is incomplete.';
  end if;

  insert into public.anonymous_ballots (election_id, submitted_at) values (p_election_id, v_submitted_at) returning id into v_ballot_id;
  for v_position in select p.* from public.positions p join public.eligible_voters v on v.id = p_voter_id
    where p.election_id = p_election_id and (p.group_scope = 'general' or p.group_scope = v.age_group::text)
  loop
    v_choice := p_selections->>v_position.id::text;
    if v_choice = 'abstain' then
      if not v_position.abstain_enabled then raise exception 'Abstention is not allowed for %.', v_position.name; end if;
      insert into public.ballot_selections (anonymous_ballot_id, position_id, is_abstain) values (v_ballot_id, v_position.id, true);
    elsif exists (select 1 from public.nominees where id = v_choice::uuid and position_id = v_position.id and active) then
      insert into public.ballot_selections (anonymous_ballot_id, position_id, nominee_id) values (v_ballot_id, v_position.id, v_choice::uuid);
    else
      raise exception 'An invalid selection was submitted for %.', v_position.name;
    end if;
  end loop;
  insert into public.participation (election_id, eligible_voter_id, verified_at, submitted_at)
  values (p_election_id, p_voter_id, now(), v_submitted_at)
  on conflict (election_id, eligible_voter_id) do update set submitted_at = excluded.submitted_at;
  insert into public.audit_events (election_id, action, affected_record_type, affected_record_id, change_summary)
  values (p_election_id, 'ballot_submitted', 'anonymous_ballot', v_ballot_id, '{}'::jsonb);
  return v_submitted_at;
end;
$$;

create or replace function public.delete_election(p_election_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.elections where id = p_election_id and status in ('draft', 'archived')) then
    raise exception 'Only draft or archived elections can be deleted.';
  end if;
  delete from public.ballot_selections where anonymous_ballot_id in (select id from public.anonymous_ballots where election_id = p_election_id);
  delete from public.anonymous_ballots where election_id = p_election_id;
  delete from public.audit_events where election_id = p_election_id;
  delete from public.elections where id = p_election_id;
end;
$$;

revoke execute on function public.sync_election(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_ballot(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_election(uuid) from public, anon, authenticated;
grant execute on function public.sync_election(jsonb, jsonb) to service_role;
grant execute on function public.submit_ballot(uuid, uuid, jsonb) to service_role;
grant execute on function public.delete_election(uuid) to service_role;
