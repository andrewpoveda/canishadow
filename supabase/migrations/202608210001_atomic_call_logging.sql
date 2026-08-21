-- Atomically add/reuse a clinic, append its call ledger entry, and derive its
-- crowdsourced map status. Apply this after 202608200001_expand_clinic_states.sql.
begin;

alter table public.contact_logs
  add column if not exists submission_key uuid;

create unique index if not exists contact_logs_submission_key_key
  on public.contact_logs (submission_key)
  where submission_key is not null;

-- Supabase's RLS event trigger still runs as an event trigger without Data API
-- execution grants. Remove the unrelated anonymous/authenticated RPC exposure
-- reported by the database security advisor.
do $revoke_rls_helper$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$revoke_rls_helper$;

create or replace function public.log_clinic_call(
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
  p_npi text
)
returns jsonb
language plpgsql
security definer
-- Intentional anonymous submission API: every relation is schema-qualified,
-- inputs are bounded/validated, and PUBLIC execution is revoked below.
set search_path = pg_catalog
as $$
declare
  v_clinic public.clinics%rowtype;
  v_log public.contact_logs%rowtype;
  v_created boolean := false;
  v_providers jsonb;
  v_status text;
  v_specialties text[];
begin
  if p_submission_key is null then
    raise exception using errcode = '22023', message = 'submission key is required';
  end if;
  if p_outcome not in ('yes', 'no', 'call_back') then
    raise exception using errcode = '22023', message = 'invalid outcome';
  end if;
  if length(coalesce(p_provider_name, '')) > 200
     or length(coalesce(p_logged_by, '')) > 200
     or length(coalesce(p_contact_email, '')) > 320
     or length(coalesce(p_notes, '')) > 2000
     or length(coalesce(p_phone, '')) > 50
     or coalesce(cardinality(p_specialties), 0) > 50
     or coalesce(p_provider_count, 1) < 1
     or coalesce(p_provider_count, 1) > 100000
     or (p_npi is not null and p_npi !~ '^[0-9]{10}$')
     or ((p_lat is null) <> (p_lng is null))
     or (p_lat is not null and p_lat not between -90 and 90)
     or (p_lng is not null and p_lng not between -180 and 180)
     or exists (
       select 1 from unnest(coalesce(p_specialties, '{}')) as specialty
       where length(specialty) > 100
     ) then
    raise exception using errcode = '22023', message = 'invalid call details';
  end if;

  -- Serializes network retries carrying the same idempotency key.
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
       then
      raise exception using errcode = '22023', message = 'invalid clinic details';
    end if;

    -- Serializes two users adding the same canonical (address, ZIP) location.
    perform pg_advisory_xact_lock(hashtextextended(p_address || '|' || p_zip, 2));
    select * into v_clinic
    from public.clinics
    where address = p_address and zip = p_zip
    order by created_at asc
    limit 1
    for update;

    if not found then
      insert into public.clinics (
        name, address, city, state, zip, lat, lng, phone, status,
        provider_count, specialties, providers, contact_email, npi,
        verified, last_verified, verified_by, notes, source
      ) values (
        btrim(p_name), btrim(p_address), btrim(p_city), p_state, p_zip,
        p_lat, p_lng, nullif(btrim(p_phone), ''), 'unknown',
        greatest(coalesce(p_provider_count, 1), 1), coalesce(p_specialties, '{}'),
        '[]'::jsonb, null, p_npi, false, null, null, null, 'student_search'
      ) returning * into v_clinic;
      v_created := true;
    end if;
  end if;

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

  update public.clinics
  set status = v_status,
      providers = v_providers,
      provider_count = greatest(provider_count, coalesce(p_provider_count, 1), 1),
      specialties = v_specialties,
      phone = coalesce(phone, nullif(btrim(p_phone), '')),
      npi = coalesce(npi, p_npi),
      contact_email = coalesce(nullif(btrim(p_contact_email), ''), contact_email),
      lat = coalesce(lat, p_lat),
      lng = coalesce(lng, p_lng),
      notes = case when notes = 'geocode_failed' and p_lat is not null then null else notes end,
      last_verified = case when verified then last_verified else current_date end,
      verified_by = case
        when verified then verified_by
        else coalesce(nullif(btrim(p_logged_by), ''), verified_by, 'student')
      end
  where id = v_clinic.id
  returning * into v_clinic;

  insert into public.contact_logs (
    clinic_id, outcome, notes, logged_by, contact_email, submission_key
  ) values (
    v_clinic.id, p_outcome, nullif(btrim(p_notes), ''),
    nullif(btrim(p_logged_by), ''), nullif(btrim(p_contact_email), ''),
    p_submission_key
  ) returning * into v_log;

  return jsonb_build_object(
    'clinic', to_jsonb(v_clinic),
    'log', to_jsonb(v_log),
    'created', v_created
  );
end;
$$;

revoke all on function public.log_clinic_call(
  uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, double precision, double precision, text, integer, text[], text
) from public;
grant execute on function public.log_clinic_call(
  uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, double precision, double precision, text, integer, text[], text
) to anon, authenticated;

commit;
