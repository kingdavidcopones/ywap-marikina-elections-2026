-- A published election with no closes_at should stay open indefinitely,
-- matching how nominations already treat a null closes_at as no upper bound.
create or replace function public.submit_ballot(p_election_id uuid, p_voter_id uuid, p_selections jsonb)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  v_ballot_id uuid;
  v_submitted_at timestamptz := now();
  v_position public.positions%rowtype;
  v_choice text;
  v_eligible_position_ids uuid[];
  v_expected_count integer;
  v_anonymous boolean;
begin
  select anonymous_voting into v_anonymous from public.elections
    where id = p_election_id and status = 'open' and opens_at <= now() and (closes_at is null or closes_at >= now());
  if not found then raise exception 'This election is not open for voting.'; end if;

  perform 1 from public.eligible_voters where id = p_voter_id and election_id = p_election_id and eligible for update;
  if not found then raise exception 'This voter is not eligible for the election.'; end if;
  if exists (select 1 from public.participation where election_id = p_election_id and eligible_voter_id = p_voter_id and submitted_at is not null) then
    raise exception 'A ballot has already been submitted for this voter.';
  end if;

  v_eligible_position_ids := public.eligible_position_ids(p_election_id, p_voter_id);
  v_expected_count := cardinality(v_eligible_position_ids);
  if v_expected_count = 0 or jsonb_typeof(p_selections) is distinct from 'object' then
    raise exception 'The ballot is incomplete.';
  end if;
  if (select count(*) from jsonb_object_keys(p_selections)) <> v_expected_count then
    raise exception 'The ballot is incomplete.';
  end if;

  insert into public.anonymous_ballots (election_id, eligible_voter_id, submitted_at)
  values (p_election_id, case when v_anonymous then null else p_voter_id end, v_submitted_at)
  returning id into v_ballot_id;

  for v_position in select p.* from public.positions p
    where p.election_id = p_election_id and p.id = any(v_eligible_position_ids)
    order by p.display_order
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
