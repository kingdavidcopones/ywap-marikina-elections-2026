-- Preserve the existing election synchronization, then apply the explicit
-- Voter eligibility imported from the member CSV. Nominee eligibility remains
-- in eligible_voters.attributes because it controls candidate selection only.
create or replace function public.sync_election(p_election jsonb, p_voters jsonb default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_election_id uuid := (p_election->>'id')::uuid;
  v_anonymous boolean;
begin
  select coalesce((p_election->>'anonymousVoting')::boolean, anonymous_voting)
    into v_anonymous from public.elections where id = v_election_id;
  v_anonymous := coalesce(v_anonymous, (p_election->>'anonymousVoting')::boolean, true);

  perform public.sync_election_without_anonymity(p_election, p_voters);

  if p_voters is not null then
    update public.eligible_voters as voter
      set eligible = coalesce((imported.value->>'eligible')::boolean, true)
      from jsonb_array_elements(p_voters) as imported(value)
      where voter.election_id = v_election_id
        and voter.member_id_normalized = upper(trim(imported.value->>'memberId'));
  end if;

  update public.elections set anonymous_voting = v_anonymous where id = v_election_id;
  return v_election_id;
end;
$$;

revoke execute on function public.sync_election(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_election(jsonb, jsonb) to service_role;
