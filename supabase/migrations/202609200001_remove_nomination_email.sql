-- Nominations no longer collect or validate a nominator email: anyone with the
-- published form link can submit without an email-based identity check, and a
-- nominator name (still optional) is no longer required to be unique.
drop index public.nomination_submissions_email_unique_idx;

alter table public.nomination_submissions
  drop column nominator_email_normalized,
  drop column nominator_email;

drop function public.submit_nomination(uuid, text, text, text, jsonb);

create function public.submit_nomination(p_nomination_id uuid, p_age_group text, p_nominator_name text, p_choices jsonb)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  v_nomination public.nominations%rowtype;
  v_position public.nomination_positions%rowtype;
  v_choice jsonb;
  v_record public.nomination_youth_records%rowtype;
  v_submission_id uuid;
  v_submitted_at timestamptz := now();
  v_name text;
  v_record_id uuid;
begin
  if p_age_group not in ('teens', 'young_people', 'young_adults') or p_age_group is null then
    raise exception 'Choose a valid age group.';
  end if;
  select * into v_nomination from public.nominations where id = p_nomination_id for update;
  if not found or not (
    v_nomination.status = 'published' or
    (v_nomination.status = 'scheduled' and v_nomination.opens_at <= v_submitted_at)
  ) or (v_nomination.closes_at is not null and v_nomination.closes_at < v_submitted_at) then
    raise exception 'This nomination is not accepting responses.';
  end if;

  if jsonb_typeof(p_choices) is distinct from 'object' then
    raise exception 'Complete every required position available to your age group.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_choices) as choice(position_id)
    where not exists (
      select 1 from public.nomination_positions as position
      where position.nomination_id = p_nomination_id
        and position.id::text = choice.position_id
        and (cardinality(position.eligible_age_groups) = 0 or p_age_group = any(position.eligible_age_groups))
    )
  ) then
    raise exception 'Complete every required position available to your age group.';
  end if;

  insert into public.nomination_submissions (nomination_id, age_group, nominator_name, submitted_at)
  values (p_nomination_id, p_age_group, nullif(trim(coalesce(p_nominator_name, '')), ''), v_submitted_at)
  returning id into v_submission_id;
  for v_position in select * from public.nomination_positions
    where nomination_id = p_nomination_id
      and (cardinality(eligible_age_groups) = 0 or p_age_group = any(eligible_age_groups)) loop
    v_choice := p_choices -> v_position.id::text;
    v_name := trim(coalesce(v_choice->>'name', ''));
    if v_name = '' then
      if v_position.required then
        raise exception 'Enter a nominee name for every required position.';
      end if;
      continue;
    end if;
    if length(v_name) < 2 or length(v_name) > 160 then
      raise exception 'Use 2 to 160 characters for every nominee name.';
    end if;
    v_record_id := nullif(v_choice->>'youthRecordId', '')::uuid;
    if v_record_id is not null then
      select * into v_record from public.nomination_youth_records where id = v_record_id and nomination_id = p_nomination_id;
      if not found then raise exception 'A selected youth record is unavailable.'; end if;
      v_name := v_record.first_name || ' ' || v_record.last_name;
    end if;
    insert into public.nomination_entries (nomination_id, submission_id, position_id, youth_record_id, nominee_name, submitted_at)
    values (p_nomination_id, v_submission_id, v_position.id, v_record_id, v_name, v_submitted_at);
  end loop;
  return v_submitted_at;
end;
$$;

revoke execute on function public.submit_nomination(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_nomination(uuid, text, text, jsonb) to service_role;
