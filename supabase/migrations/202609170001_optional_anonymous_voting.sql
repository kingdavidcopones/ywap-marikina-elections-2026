-- Existing elections and ballots retain their anonymous behavior.
alter table public.elections add column anonymous_voting boolean not null default true;
alter table public.anonymous_ballots add column eligible_voter_id uuid references public.eligible_voters(id) on delete restrict;
create unique index individual_ballot_per_voter on public.anonymous_ballots(election_id, eligible_voter_id)
  where eligible_voter_id is not null;

create or replace function public.enforce_ballot_anonymity()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_anonymous boolean;
begin
  select anonymous_voting into v_anonymous from public.elections where id = new.election_id;
  if v_anonymous and new.eligible_voter_id is not null then
    raise exception 'Anonymous ballots cannot be linked to voters.';
  end if;
  if not v_anonymous and new.eligible_voter_id is null then
    raise exception 'This election requires a voter-linked ballot.';
  end if;
  if new.eligible_voter_id is not null and not exists (
    select 1 from public.eligible_voters where id = new.eligible_voter_id and election_id = new.election_id
  ) then
    raise exception 'The linked voter does not belong to this election.';
  end if;
  return new;
end;
$$;

create trigger enforce_ballot_anonymity_before_write
  before insert or update of election_id, eligible_voter_id on public.anonymous_ballots
  for each row execute function public.enforce_ballot_anonymity();

create or replace function public.protect_election_anonymity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.anonymous_voting is distinct from new.anonymous_voting then
    if old.status in ('scheduled', 'open', 'published', 'archived') then
      raise exception 'Anonymous voting cannot be changed while the election is %.', old.status;
    end if;
    if exists (select 1 from public.anonymous_ballots where election_id = old.id) then
      raise exception 'Anonymous voting cannot be changed after a ballot has been submitted.';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_election_anonymity_before_update
  before update of anonymous_voting on public.elections
  for each row execute function public.protect_election_anonymity();

-- Keep the prior voter/position synchronization intact, then save the new
-- election-level flag in the same transaction as the rest of the election.
alter function public.sync_election(jsonb, jsonb) rename to sync_election_without_anonymity;

create function public.sync_election(p_election jsonb, p_voters jsonb default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_election_id uuid := (p_election->>'id')::uuid;
  v_anonymous boolean;
begin
  select coalesce((p_election->>'anonymousVoting')::boolean, anonymous_voting)
    into v_anonymous from public.elections where id = v_election_id;
  v_anonymous := coalesce(v_anonymous, (p_election->>'anonymousVoting')::boolean, true);

  perform public.sync_election_without_anonymity(p_election, p_voters);
  update public.elections set anonymous_voting = v_anonymous where id = v_election_id;
  return v_election_id;
end;
$$;

revoke execute on function public.sync_election(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_election(jsonb, jsonb) to service_role;

create or replace function public.submit_ballot(p_election_id uuid, p_voter_id uuid, p_selections jsonb)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  v_ballot_id uuid;
  v_submitted_at timestamptz := now();
  v_position public.positions%rowtype;
  v_choice text;
  v_expected_count integer;
  v_anonymous boolean;
begin
  select anonymous_voting into v_anonymous from public.elections
    where id = p_election_id and status = 'open' and opens_at <= now() and closes_at >= now();
  if not found then raise exception 'This election is not open for voting.'; end if;
  perform 1 from public.eligible_voters where id = p_voter_id and election_id = p_election_id and eligible for update;
  if not found then raise exception 'This voter is not eligible for the election.'; end if;
  if exists (select 1 from public.participation where election_id = p_election_id and eligible_voter_id = p_voter_id and submitted_at is not null) then
    raise exception 'A ballot has already been submitted for this voter.';
  end if;

  select count(*) into v_expected_count from public.positions p
  join public.eligible_voters v on v.id = p_voter_id
  where p.election_id = p_election_id and (p.group_scope = 'general' or p.group_scope = v.age_group::text)
    and public.position_allows_voter(p.voting_rule, v.attributes);
  if (select count(*) from jsonb_object_keys(p_selections)) <> v_expected_count then
    raise exception 'The ballot is incomplete.';
  end if;

  insert into public.anonymous_ballots (election_id, eligible_voter_id, submitted_at)
  values (p_election_id, case when v_anonymous then null else p_voter_id end, v_submitted_at)
  returning id into v_ballot_id;
  for v_position in select p.* from public.positions p join public.eligible_voters v on v.id = p_voter_id
    where p.election_id = p_election_id and (p.group_scope = 'general' or p.group_scope = v.age_group::text)
      and public.position_allows_voter(p.voting_rule, v.attributes)
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
