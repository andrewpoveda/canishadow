-- Run after both production migrations in a staging Supabase SQL editor.
-- Every fixture and call is rolled back; any failed invariant aborts the script.
begin;

do $test$
declare
  v_submission_key uuid := gen_random_uuid();
  v_verified_key uuid := gen_random_uuid();
  v_address text := upper(gen_random_uuid()::text) || ' TEST ST';
  v_result jsonb;
  v_retry jsonb;
  v_clinic_id uuid;
  v_log_id uuid;
  v_verified_id uuid;
  v_count integer;
  v_clinic public.clinics%rowtype;
begin
  select public.log_clinic_call(
    v_submission_key, null, 'yes', null, 'QA', null, 'atomic test',
    'QA ATOMIC CLINIC', v_address, 'LOS ANGELES', 'CA', '90001',
    34.0522, -118.2437, null, 1, array['Family Medicine'], null
  ) into v_result;

  if v_result->>'created' <> 'true' then
    raise exception 'new clinic was not reported as created';
  end if;
  v_clinic_id := (v_result->'clinic'->>'id')::uuid;
  v_log_id := (v_result->'log'->>'id')::uuid;

  select count(*) into v_count from public.clinics where id = v_clinic_id;
  if v_count <> 1 then raise exception 'clinic insert count was %', v_count; end if;
  select count(*) into v_count from public.contact_logs where clinic_id = v_clinic_id;
  if v_count <> 1 then raise exception 'call insert count was %', v_count; end if;
  select * into v_clinic from public.clinics where id = v_clinic_id;
  if v_clinic.status <> 'verified_yes' or v_clinic.verified then
    raise exception 'crowdsourced clinic trust/status was incorrect';
  end if;

  -- An identical network retry must return the original ledger row, not append one.
  select public.log_clinic_call(
    v_submission_key, null, 'yes', null, 'QA', null, 'atomic test',
    'QA ATOMIC CLINIC', v_address, 'LOS ANGELES', 'CA', '90001',
    34.0522, -118.2437, null, 1, array['Family Medicine'], null
  ) into v_retry;
  if (v_retry->'log'->>'id')::uuid <> v_log_id then
    raise exception 'idempotent retry returned a different log';
  end if;
  select count(*) into v_count from public.contact_logs where clinic_id = v_clinic_id;
  if v_count <> 1 then raise exception 'retry created % call rows', v_count; end if;

  -- Anonymous call context may append to a team-verified clinic but cannot replace
  -- the trusted status, date, or byline.
  insert into public.clinics (
    name, address, city, state, zip, lat, lng, status, provider_count,
    specialties, providers, verified, last_verified, verified_by, source
  ) values (
    'QA VERIFIED CLINIC', upper(gen_random_uuid()::text) || ' VERIFIED ST',
    'NEW YORK', 'NY', '10001', 40.7128, -74.0060, 'verified_yes', 1,
    '{}', '[]', true, date '2026-01-01', 'Andrew', 'demo'
  ) returning id into v_verified_id;

  perform public.log_clinic_call(
    v_verified_key, v_verified_id, 'no', 'Dr. QA', 'Anonymous QA', null, null,
    null, null, null, null, null, null, null, null, 1, '{}', null
  );
  select * into v_clinic from public.clinics where id = v_verified_id;
  if v_clinic.status <> 'verified_yes'
     or v_clinic.last_verified <> date '2026-01-01'
     or v_clinic.verified_by <> 'Andrew' then
    raise exception 'team-verified fields were overwritten';
  end if;
end;
$test$;

rollback;
