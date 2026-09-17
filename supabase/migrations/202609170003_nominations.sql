create type public.nomination_status as enum ('draft', 'scheduled', 'published', 'archived');

create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  status public.nomination_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nomination_window_valid check (opens_at is null or closes_at is null or closes_at > opens_at)
);

create table public.nomination_positions (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.nominations(id) on delete cascade,
  name text not null,
  show_role_details boolean not null default false,
  about_role text not null default '',
  responsibilities jsonb not null default '[]'::jsonb,
  display_order integer not null,
  unique (nomination_id, display_order)
);

create table public.nomination_youth_records (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.nominations(id) on delete cascade,
  member_id text not null,
  member_id_normalized text not null,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (first_name || ' ' || last_name) stored,
  age_group text not null,
  gender text,
  age integer check (age is null or age between 0 and 120),
  birth_date date,
  attributes jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (nomination_id, member_id_normalized)
);

create table public.nomination_submissions (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.nominations(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

create table public.nomination_entries (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.nominations(id) on delete cascade,
  submission_id uuid not null references public.nomination_submissions(id) on delete cascade,
  position_id uuid not null references public.nomination_positions(id) on delete cascade,
  youth_record_id uuid references public.nomination_youth_records(id) on delete set null,
  nominee_name text not null,
  submitted_at timestamptz not null default now(),
  unique (submission_id, position_id)
);

create index nomination_entries_nomination_time_idx on public.nomination_entries (nomination_id, submitted_at desc);
create index nomination_records_name_idx on public.nomination_youth_records (nomination_id, last_name, first_name);

alter table public.nominations enable row level security;
alter table public.nomination_positions enable row level security;
alter table public.nomination_youth_records enable row level security;
alter table public.nomination_submissions enable row level security;
alter table public.nomination_entries enable row level security;

-- All access goes through authenticated admin or constrained public route handlers.
-- The service role bypasses RLS. Public browser roles get no table policy.
create or replace function public.submit_nomination(p_nomination_id uuid, p_choices jsonb)
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
  select * into v_nomination from public.nominations where id = p_nomination_id for update;
  if not found or not (
    v_nomination.status = 'published' or
    (v_nomination.status = 'scheduled' and v_nomination.opens_at <= v_submitted_at)
  ) or (v_nomination.closes_at is not null and v_nomination.closes_at < v_submitted_at) then
    raise exception 'This nomination is not accepting responses.';
  end if;
  if (select count(*) from jsonb_object_keys(p_choices)) <> (select count(*) from public.nomination_positions where nomination_id = p_nomination_id)
    or (select count(*) from public.nomination_positions where nomination_id = p_nomination_id) = 0 then
    raise exception 'Complete every position before submitting.';
  end if;
  insert into public.nomination_submissions (nomination_id, submitted_at)
  values (p_nomination_id, v_submitted_at) returning id into v_submission_id;
  for v_position in select * from public.nomination_positions where nomination_id = p_nomination_id loop
    v_choice := p_choices -> v_position.id::text;
    v_name := trim(coalesce(v_choice->>'name', ''));
    if length(v_name) < 2 or length(v_name) > 160 then
      raise exception 'Enter a nominee name for every position.';
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

create or replace function public.save_nomination_youth_records(p_nomination_id uuid, p_mode text, p_records jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_status public.nomination_status;
  v_record jsonb;
  v_member_id text;
  v_seen text[] := '{}';
begin
  select status into v_status from public.nominations where id = p_nomination_id for update;
  if not found then raise exception 'Nomination not found.'; end if;
  if v_status <> 'draft' then raise exception 'Unpublish the nomination before changing Youth Records.'; end if;
  if p_mode not in ('add', 'replace') or jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) not between 1 and 10000 then
    raise exception 'Choose a valid Youth Records upload.';
  end if;
  for v_record in select value from jsonb_array_elements(p_records) loop
    v_member_id := upper(trim(v_record->>'memberId'));
    if v_member_id = any(v_seen) then raise exception 'Duplicate Member ID in upload.'; end if;
    v_seen := array_append(v_seen, v_member_id);
    insert into public.nomination_youth_records
      (nomination_id, member_id, member_id_normalized, first_name, last_name, age_group, gender, age, birth_date, attributes, imported_at)
    values
      (p_nomination_id, trim(v_record->>'memberId'), v_member_id, trim(v_record->>'firstName'), trim(v_record->>'lastName'),
       trim(v_record->>'ageGroup'), nullif(trim(v_record->>'gender'), ''), (v_record->>'age')::integer,
       (v_record->>'birthDate')::date, coalesce(v_record->'attributes', '{}'::jsonb), now())
    on conflict (nomination_id, member_id_normalized) do update set
      member_id = excluded.member_id, first_name = excluded.first_name, last_name = excluded.last_name,
      age_group = excluded.age_group, gender = excluded.gender, age = excluded.age,
      birth_date = excluded.birth_date, attributes = excluded.attributes, imported_at = excluded.imported_at;
  end loop;
  if p_mode = 'replace' then
    delete from public.nomination_youth_records where nomination_id = p_nomination_id and member_id_normalized <> all(v_seen);
  end if;
  return array_length(v_seen, 1);
end;
$$;

revoke execute on function public.submit_nomination(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_nomination(uuid, jsonb) to service_role;
revoke execute on function public.save_nomination_youth_records(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_nomination_youth_records(uuid, text, jsonb) to service_role;
