-- Preserve imported CSV fields and enforce per-position voter filters.
alter table public.eligible_voters add column attributes jsonb not null default '{}'::jsonb;
alter table public.positions add column voting_rule jsonb not null default '{"type":"all","filters":[]}'::jsonb;

update public.eligible_voters set attributes = jsonb_strip_nulls(jsonb_build_object(
  'member_id', member_id, 'first_name', first_name, 'last_name', last_name,
  'gender', gender, 'age', age::text, 'birth_date', birth_date::text,
  'age_group', case age_group when 'young_people' then 'Young People' when 'young_adults' then 'Young Adults' else 'Teens' end
));

create or replace function public.position_allows_voter(p_rule jsonb, p_attributes jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_filter jsonb;
  v_count integer;
  v_actual text;
  v_expected text;
  v_result boolean;
  v_matches boolean := false;
  v_index integer := 0;
begin
  if coalesce(p_rule->>'type', 'all') = 'all' then return true; end if;
  if p_rule->>'type' <> 'custom' or jsonb_typeof(p_rule->'filters') <> 'array' then return false; end if;
  v_count := jsonb_array_length(p_rule->'filters');
  if v_count < 1 or v_count > 5 then return false; end if;
  for v_filter in select value from jsonb_array_elements(p_rule->'filters') as item(value) loop
    v_index := v_index + 1;
    if coalesce(v_filter->>'column', '') = '' then return false; end if;
    v_actual := lower(trim(coalesce(p_attributes ->> (v_filter->>'column'), '')));
    v_expected := lower(trim(coalesce(v_filter->>'value', '')));
    v_result := case v_filter->>'condition'
      when 'equals' then v_actual = v_expected
      when 'not_equals' then v_actual <> v_expected
      when 'contains' then position(v_expected in v_actual) > 0
      when 'not_contains' then position(v_expected in v_actual) = 0
      when 'is_empty' then v_actual = ''
      when 'is_not_empty' then v_actual <> ''
      else false
    end;
    if v_index = 1 then
      v_matches := v_result;
    elsif v_filter->>'join' = 'or' then
      v_matches := v_matches or v_result;
    else
      v_matches := v_matches and v_result;
    end if;
  end loop;
  return v_matches;
end;
$$;

create or replace function public.eligible_position_ids(p_election_id uuid, p_voter_id uuid)
returns uuid[] language sql stable security invoker set search_path = '' as $$
  select coalesce(array_agg(p.id order by p.display_order), '{}'::uuid[])
  from public.positions p
  join public.eligible_voters v on v.id = p_voter_id and v.election_id = p_election_id and v.eligible
  where p.election_id = p_election_id
    and (p.group_scope = 'general' or p.group_scope = v.age_group::text)
    and public.position_allows_voter(p.voting_rule, v.attributes);
$$;

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
    insert into public.positions (id, election_id, name, group_scope, description, responsibilities, voting_rule, display_order, abstain_enabled)
    values ((v_position->>'id')::uuid, v_election_id, v_position->>'name', v_group, coalesce(v_position->>'description', ''), coalesce(v_position->'responsibilities', '[]'::jsonb), coalesce(v_position->'votingRule', '{"type":"all","filters":[]}'::jsonb),
      (select ordinality from jsonb_array_elements(p_election->'positions') with ordinality x(value, ordinality) where x.value->>'id' = v_position->>'id' limit 1),
      coalesce((v_position->>'abstainEnabled')::boolean, false))
    on conflict (id) do update set name = excluded.name, group_scope = excluded.group_scope, description = excluded.description,
      responsibilities = excluded.responsibilities, voting_rule = excluded.voting_rule, display_order = excluded.display_order, abstain_enabled = excluded.abstain_enabled;

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
      insert into public.eligible_voters (election_id, member_id, member_id_normalized, first_name, last_name, last_name_normalized, gender, age, birth_date, age_group, attributes, eligible)
      values (v_election_id, v_voter->>'memberId', upper(trim(v_voter->>'memberId')),
        coalesce(nullif(v_voter->>'firstName', ''), array_to_string(v_name_parts[1:array_length(v_name_parts, 1)-1], ' ')),
        coalesce(nullif(v_voter->>'lastName', ''), v_name_parts[array_length(v_name_parts, 1)]),
        lower(trim(coalesce(nullif(v_voter->>'lastName', ''), v_name_parts[array_length(v_name_parts, 1)]))),
        nullif(v_voter->>'gender', ''), nullif(v_voter->>'age', '')::integer, nullif(v_voter->>'birthDate', '')::date, v_group::public.age_group, coalesce(v_voter->'attributes', jsonb_build_object('member_id', v_voter->>'memberId', 'first_name', v_voter->>'firstName', 'last_name', v_voter->>'lastName', 'gender', v_voter->>'gender', 'age', v_voter->>'age', 'birth_date', v_voter->>'birthDate', 'age_group', v_voter->>'ageGroup')), true)
      on conflict (election_id, member_id_normalized) do update set first_name = excluded.first_name, last_name = excluded.last_name,
        last_name_normalized = excluded.last_name_normalized, gender = excluded.gender, age = excluded.age,
        birth_date = excluded.birth_date, age_group = excluded.age_group, attributes = excluded.attributes, eligible = true, imported_at = now();
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
  where p.election_id = p_election_id and (p.group_scope = 'general' or p.group_scope = v.age_group::text) and public.position_allows_voter(p.voting_rule, v.attributes);
  if (select count(*) from jsonb_object_keys(p_selections)) <> v_expected_count then
    raise exception 'The ballot is incomplete.';
  end if;

  insert into public.anonymous_ballots (election_id, submitted_at) values (p_election_id, v_submitted_at) returning id into v_ballot_id;
  for v_position in select p.* from public.positions p join public.eligible_voters v on v.id = p_voter_id
    where p.election_id = p_election_id and (p.group_scope = 'general' or p.group_scope = v.age_group::text) and public.position_allows_voter(p.voting_rule, v.attributes)
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
