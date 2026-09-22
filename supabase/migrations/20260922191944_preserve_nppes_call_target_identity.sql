-- Keep map rows keyed by their full canonical (address, ZIP) location while
-- recording NPPES targets and contact-quality reports separately from location
-- level shadowing status. Apply before deploying the matching app RPC clients.
begin;

alter table public.contact_logs
  add column if not exists target_npi text,
  add column if not exists target_enumeration_type text,
  add column if not exists target_name text,
  add column if not exists target_address text,
  add column if not exists target_city text,
  add column if not exists target_state text,
  add column if not exists target_zip text,
  add column if not exists target_phone text,
  add column if not exists target_specialties text[] not null default '{}',
  add column if not exists target_source text,
  add column if not exists target_phone_source text,
  add column if not exists target_phone_status text;

alter table public.contact_logs
  add constraint contact_logs_target_npi_format
    check (target_npi is null or target_npi ~ '^[0-9]{10}$'),
  add constraint contact_logs_target_enumeration_type_check
    check (target_enumeration_type is null or target_enumeration_type in ('NPI-1', 'NPI-2')),
  add constraint contact_logs_target_phone_status_check
    check (target_phone_status is null or target_phone_status = 'unconfirmed');

create table public.contact_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid references public.clinics(id) on delete set null,
  reason text not null check (reason in ('wrong_number', 'practice_closed')),
  target_npi text not null check (target_npi ~ '^[0-9]{10}$'),
  target_enumeration_type text not null check (target_enumeration_type in ('NPI-1', 'NPI-2')),
  target_name text not null,
  target_address text not null,
  target_city text not null,
  target_state text not null check (target_state ~ '^[A-Z]{2}$'),
  target_zip text not null check (target_zip ~ '^[0-9]{5}$'),
  target_phone text,
  target_source text not null default 'NPPES NPI Registry'
    check (target_source = 'NPPES NPI Registry'),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'reviewed')),
  submission_key uuid not null unique
);

create index contact_reports_clinic_idx on public.contact_reports (clinic_id, created_at desc);
create index contact_reports_target_idx
  on public.contact_reports (target_npi, target_address, target_zip, created_at desc);

alter table public.contact_reports enable row level security;
create policy "contact reports public read"
  on public.contact_reports for select using (true);
revoke all on public.contact_reports from public, anon, authenticated;
grant select on public.contact_reports to anon, authenticated;

create or replace function public.normalize_clinic_address(p_address text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  with punctuation as (
    select upper(regexp_replace(p_address, '[.,]', ' ', 'g')) as value
  ), unit_marks as (
    select regexp_replace(value, '#', ' UNIT ', 'g') as value from punctuation
  ), unit_names as (
    select regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(value, '\m(STE|SUITES?)\M', ' SUITE ', 'g'),
              '\m(APT|APARTMENT)\M', ' APT ', 'g'
            ),
            '\mUNITS?\M', ' UNIT ', 'g'
          ),
          '\m(FL|FLOOR)\M', ' FLOOR ', 'g'
        ),
        '\m(RM|ROOM)\M', ' ROOM ', 'g'
      ),
      '\m(BLDG|BUILDING)\M', ' BUILDING ', 'g'
    ) as value
    from unit_marks
  ), street_names as (
    select regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(value, '\mSTREET\M', ' ST ', 'g'),
              '\mAVENUE\M', ' AVE ', 'g'
            ),
            '\mBOULEVARD\M', ' BLVD ', 'g'
          ),
          '\mROAD\M', ' RD ', 'g'
        ),
        '\mDRIVE\M', ' DR ', 'g'
      ),
      '\mPARKWAY\M', ' PKWY ', 'g'
    ) as value
    from unit_names
  ), normalized as (
    select regexp_replace(value, '\mHIGHWAY\M', ' HWY ', 'g') as value
    from street_names
  ), suite_marks as (
    select regexp_replace(
      regexp_replace(value, '\mSUITE\M\s+\mUNIT\M', ' SUITE ', 'g'),
      '\mAPT\M\s+\mUNIT\M', ' APT ', 'g'
    ) as value from normalized
  )
  select btrim(regexp_replace(value, '\s+', ' ', 'g')) from suite_marks;
$$;
revoke all on function public.normalize_clinic_address(text) from public, anon, authenticated;

-- The old RPC allowed an 18-argument client to write a grouped NPI/phone without
-- an enumeration type. Retire it so stale clients fail closed during rollout.
drop function public.log_clinic_call(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  double precision, double precision, text, integer, text[], text
);

-- The RPC is the only public write path for the target snapshot. Retire legacy
-- direct-write access so clients cannot create logs without a selected target.
drop policy if exists "logs public insert" on public.contact_logs;
revoke all on public.contact_logs from public, anon, authenticated;
grant select on public.contact_logs to anon, authenticated;

create function public.log_clinic_call(
  p_submission_key uuid,
  p_clinic_id uuid,
  p_outcome text,
  p_provider_name text,
  p_logged_by text,
  p_contact_email text,
  p_notes text,
  p_name text,
  p_address text,
  p_city text,
  p_state text,
  p_zip text,
  p_lat double precision,
  p_lng double precision,
  p_phone text,
  p_provider_count integer,
  p_specialties text[],
  p_npi text,
  p_target_enumeration_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_clinic public.clinics%rowtype;
  v_log public.contact_logs%rowtype;
  v_created boolean := false;
  v_providers jsonb;
  v_status text;
  v_specialties text[];
  v_address text;
  v_is_registry_target boolean := p_npi is not null;
begin
  if p_submission_key is null then
    raise exception using errcode = '22023', message = 'submission key is required';
  end if;
  if p_outcome is null or p_outcome not in ('yes', 'no', 'call_back') then
    raise exception using errcode = '22023', message = 'invalid outcome';
  end if;
  if length(coalesce(p_provider_name, '')) > 200
     or length(coalesce(p_logged_by, '')) > 200
     or length(coalesce(p_contact_email, '')) > 320
     or length(coalesce(p_notes, '')) > 2000
     or length(coalesce(p_phone, '')) > 50
     or length(coalesce(p_name, '')) > 300
     or length(coalesce(p_address, '')) > 300
     or length(coalesce(p_city, '')) > 150
     or coalesce(cardinality(p_specialties), 0) > 50
     or coalesce(p_provider_count, 1) < 1
     or coalesce(p_provider_count, 1) > 100000
     or (p_npi is not null and p_npi !~ '^[0-9]{10}$')
     or (p_npi is not null and (p_target_enumeration_type is null
       or p_target_enumeration_type not in ('NPI-1', 'NPI-2')))
     or (p_npi is null and p_target_enumeration_type is not null)
     or (p_state is not null and p_state !~ '^[A-Z]{2}$')
     or (p_zip is not null and p_zip !~ '^[0-9]{5}$')
     or ((p_lat is null) <> (p_lng is null))
     or (p_lat is not null and p_lat not between -90 and 90)
     or (p_lng is not null and p_lng not between -180 and 180)
     or exists (
       select 1 from unnest(coalesce(p_specialties, '{}')) as specialty
       where length(specialty) > 100
     ) then
    raise exception using errcode = '22023', message = 'invalid call details';
  end if;

  if v_is_registry_target and (
    nullif(btrim(p_name), '') is null
    or nullif(btrim(p_address), '') is null
    or nullif(btrim(p_city), '') is null
    or p_state is null or p_zip is null
  ) then
    raise exception using errcode = '22023', message = 'registry target identity is required';
  end if;
  v_address := public.normalize_clinic_address(p_address);

  perform pg_advisory_xact_lock(hashtextextended(p_submission_key::text, 1));
  select * into v_log
  from public.contact_logs
  where submission_key = p_submission_key;

  if found then
    select * into strict v_clinic
    from public.clinics
    where id = v_log.clinic_id;
    return jsonb_build_object(
      'clinic', to_jsonb(v_clinic),
      'log', to_jsonb(v_log),
      'created', false
    );
  end if;

  if p_clinic_id is not null then
    select * into v_clinic
    from public.clinics
    where id = p_clinic_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'clinic not found';
    end if;
    if v_is_registry_target and (
      public.normalize_clinic_address(v_clinic.address) is distinct from v_address
      or v_clinic.zip is distinct from p_zip
      or v_clinic.state is distinct from p_state
    ) then
      raise exception using errcode = '22023', message = 'target does not match clinic location';
    end if;
  else
    if nullif(btrim(p_name), '') is null
       or nullif(btrim(p_address), '') is null
       or nullif(btrim(p_city), '') is null
       or p_state is null
       or p_zip is null
       or p_zip !~ '^[0-9]{5}$'
       or p_lat is null
       or p_lng is null
       or length(p_name) > 300
       or length(p_address) > 300
       or length(p_city) > 150
       or (v_is_registry_target and p_target_enumeration_type is null)
       then
      raise exception using errcode = '22023', message = 'invalid clinic details';
    end if;

    -- The client canonicalizes formatting but retains suite/floor/unit tokens.
    -- Both components remain in the location lock and lookup key.
    perform pg_advisory_xact_lock(hashtextextended(v_address || '|' || p_zip, 2));
    select * into v_clinic
    from public.clinics
    where public.normalize_clinic_address(address) = v_address and zip = p_zip
    order by created_at asc
    limit 1
    for update;

    if found and v_clinic.state is distinct from p_state then
      raise exception using errcode = '22023', message = 'target state does not match clinic location';
    end if;

    if not found then
      insert into public.clinics (
        name, address, city, state, zip, lat, lng, phone, status,
        provider_count, specialties, providers, contact_email, npi,
        verified, last_verified, verified_by, notes, source
      ) values (
        'Medical office', v_address, btrim(p_city), p_state, p_zip,
        p_lat, p_lng, null, 'unknown', 1, '{}', '[]'::jsonb, null, null,
        false, null, null, null, 'student_search'
      ) returning * into v_clinic;
      v_created := true;
    end if;
  end if;

  -- NPI calls describe one registry target. They remain in the call ledger and
  -- do not merge providers, phones, or shadowing status into a location pin.
  if v_is_registry_target then
    v_providers := coalesce(v_clinic.providers, '[]'::jsonb);
    v_status := v_clinic.status;
    v_specialties := coalesce(v_clinic.specialties, '{}');
  else
    v_providers := coalesce(v_clinic.providers, '[]'::jsonb);
    if nullif(btrim(p_provider_name), '') is not null
       and p_outcome in ('yes', 'no') then
      v_providers := v_providers || jsonb_build_array(
        jsonb_build_object('name', btrim(p_provider_name), 'response', p_outcome)
      );
    end if;

    if v_clinic.verified then
      v_status := v_clinic.status;
    elsif p_outcome = 'yes'
          or v_clinic.status = 'verified_yes'
          or jsonb_path_exists(v_providers, '$[*] ? (@.response == "yes")') then
      v_status := 'verified_yes';
    elsif p_outcome = 'no' then
      v_status := 'verified_no';
    elsif v_clinic.status = 'unknown' then
      v_status := 'call_back';
    else
      v_status := v_clinic.status;
    end if;

    select coalesce(array_agg(distinct specialty order by specialty), '{}')
    into v_specialties
    from unnest(
      coalesce(v_clinic.specialties, '{}') || coalesce(p_specialties, '{}')
    ) as specialty
    where nullif(btrim(specialty), '') is not null and length(specialty) <= 100;
  end if;

  update public.clinics
  set status = v_status,
      providers = v_providers,
      provider_count = case when v_is_registry_target then provider_count
        else greatest(provider_count, coalesce(p_provider_count, 1), 1) end,
      specialties = v_specialties,
      contact_email = case when v_is_registry_target then contact_email
        else coalesce(nullif(btrim(p_contact_email), ''), contact_email) end,
      lat = coalesce(lat, p_lat),
      lng = coalesce(lng, p_lng),
      notes = case when notes = 'geocode_failed' and p_lat is not null then null else notes end,
      last_verified = case when verified or v_is_registry_target then last_verified else current_date end,
      verified_by = case when verified or v_is_registry_target then verified_by
        else coalesce(nullif(btrim(p_logged_by), ''), verified_by, 'student') end
  where id = v_clinic.id
  returning * into v_clinic;

  insert into public.contact_logs (
    clinic_id, outcome, notes, logged_by, contact_email, submission_key,
    target_npi, target_enumeration_type, target_name, target_address,
    target_city, target_state, target_zip, target_phone, target_specialties,
    target_source, target_phone_source, target_phone_status
  ) values (
    v_clinic.id, p_outcome, nullif(btrim(p_notes), ''),
    nullif(btrim(p_logged_by), ''), nullif(btrim(p_contact_email), ''),
    p_submission_key,
    p_npi, p_target_enumeration_type,
    coalesce(nullif(btrim(p_name), ''), nullif(btrim(p_provider_name), ''), v_clinic.name),
    coalesce(v_address, v_clinic.address),
    coalesce(nullif(btrim(p_city), ''), v_clinic.city),
    coalesce(p_state, v_clinic.state), coalesce(p_zip, v_clinic.zip),
    case when v_is_registry_target then nullif(btrim(p_phone), '') else null end,
    case when v_is_registry_target then coalesce(p_specialties, '{}') else '{}' end,
    case when v_is_registry_target then 'NPPES NPI Registry' else 'CanIShadow map location' end,
    case when v_is_registry_target and nullif(btrim(p_phone), '') is not null
      then 'NPPES NPI Registry' else null end,
    case when v_is_registry_target and nullif(btrim(p_phone), '') is not null
      then 'unconfirmed' else null end
  ) returning * into v_log;

  return jsonb_build_object(
    'clinic', to_jsonb(v_clinic),
    'log', to_jsonb(v_log),
    'created', v_created
  );
end;
$$;

revoke all on function public.log_clinic_call(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  double precision, double precision, text, integer, text[], text, text
) from public;
grant execute on function public.log_clinic_call(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  double precision, double precision, text, integer, text[], text, text
) to anon, authenticated;

create function public.report_clinic_contact(
  p_submission_key uuid,
  p_npi text,
  p_enumeration_type text,
  p_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_state text,
  p_zip text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_report public.contact_reports%rowtype;
  v_clinic_id uuid;
  v_address text;
begin
  if p_submission_key is null
     or p_npi is null or p_npi !~ '^[0-9]{10}$'
     or p_enumeration_type is null
     or p_enumeration_type not in ('NPI-1', 'NPI-2')
     or p_reason is null
     or p_reason not in ('wrong_number', 'practice_closed')
     or nullif(btrim(p_name), '') is null
     or nullif(btrim(p_address), '') is null
     or nullif(btrim(p_city), '') is null
     or p_state is null
     or p_state !~ '^[A-Z]{2}$'
     or p_zip is null or p_zip !~ '^[0-9]{5}$'
     or length(p_name) > 300 or length(p_address) > 300
     or length(p_city) > 150 or length(coalesce(p_phone, '')) > 50 then
    raise exception using errcode = '22023', message = 'invalid contact report';
  end if;
  v_address := public.normalize_clinic_address(p_address);

  perform pg_advisory_xact_lock(hashtextextended(p_submission_key::text, 3));
  select * into v_report
  from public.contact_reports
  where submission_key = p_submission_key;
  if found then return to_jsonb(v_report); end if;

  -- Link the report to an existing exact location only. Never create a map pin
  -- or infer a closed organization from one provider/location report.
  select id into v_clinic_id
  from public.clinics
  where public.normalize_clinic_address(address) = v_address and zip = p_zip and state = p_state
  order by created_at asc
  limit 1;

  insert into public.contact_reports (
    clinic_id, reason, target_npi, target_enumeration_type, target_name,
    target_address, target_city, target_state, target_zip, target_phone,
    target_source, submission_key
  ) values (
    v_clinic_id, p_reason, p_npi, p_enumeration_type, btrim(p_name),
    v_address, btrim(p_city), p_state, p_zip,
    nullif(btrim(p_phone), ''), 'NPPES NPI Registry', p_submission_key
  ) returning * into v_report;

  return to_jsonb(v_report);
end;
$$;

revoke all on function public.report_clinic_contact(
  uuid, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.report_clinic_contact(
  uuid, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

commit;
