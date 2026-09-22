-- Run after the identity-safe contact migration in a staging SQL editor.
-- Every fixture is rolled back; no clinic or report remains afterward.
begin;

do $test$
declare
  v_base text := upper(gen_random_uuid()::text) || ' TEST ST';
  v_zip text := '92404';
  v_one jsonb;
  v_seven jsonb;
  v_target_a jsonb;
  v_target_b jsonb;
  v_report_wrong jsonb;
  v_report_closed jsonb;
  v_suite_one_clinic uuid;
  v_suite_seven_clinic uuid;
  v_shared_clinic uuid;
  v_log_count integer;
  v_report_count integer;
  v_clinic public.clinics%rowtype;
begin
  if public.normalize_clinic_address('10 BROADWAY APT #4')
       is distinct from public.normalize_clinic_address('10 BROADWAY APARTMENT 4') then
    raise exception 'equivalent apartment formatting did not normalize to the same unit';
  end if;

  if has_table_privilege('anon', 'public.contact_logs', 'INSERT')
     or has_table_privilege('authenticated', 'public.contact_logs', 'INSERT')
     or has_table_privilege('anon', 'public.contact_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.contact_logs', 'UPDATE')
     or has_table_privilege('anon', 'public.contact_logs', 'DELETE')
     or has_table_privilege('authenticated', 'public.contact_logs', 'DELETE') then
    raise exception 'contact_logs still exposes direct public write access';
  end if;

  -- Suite 1 and Suite 7 are separate location-key values at the same base address.
  select public.log_clinic_call(
    gen_random_uuid(), null, 'call_back', null, 'QA', null, null,
    'Apple Physicians Choice', v_base || ' SUITE 7', 'SAN BERNARDINO', 'CA', v_zip,
    34.1300, -117.2900, '951-204-0909', 1, array['Family Medicine'],
    '1427857218', 'NPI-2'
  ) into v_seven;
  select public.log_clinic_call(
    gen_random_uuid(), null, 'call_back', null, 'QA', null, null,
    'San Bernardino Physicians Associates', v_base || ' SUITE 1', 'SAN BERNARDINO', 'CA', v_zip,
    34.1300, -117.2900, '909-889-1136', 1, array['Family Medicine'],
    '1487752895', 'NPI-2'
  ) into v_one;

  v_suite_seven_clinic := (v_seven->'clinic'->>'id')::uuid;
  v_suite_one_clinic := (v_one->'clinic'->>'id')::uuid;
  if v_suite_seven_clinic = v_suite_one_clinic then
    raise exception 'different suites were merged into one location';
  end if;
  if v_seven->'log'->>'target_npi' <> '1427857218'
     or v_seven->'log'->>'target_address' not like '%SUITE 7'
     or v_seven->'log'->>'target_phone' <> '951-204-0909' then
    raise exception 'Suite 7 log lost its selected NPI, address, or phone';
  end if;
  if v_one->'log'->>'target_npi' <> '1487752895'
     or v_one->'log'->>'target_address' not like '%SUITE 1'
     or v_one->'log'->>'target_phone' <> '909-889-1136' then
    raise exception 'Suite 1 log lost its selected NPI, address, or phone';
  end if;

  -- Different NPIs at the identical suite share only the map location row.
  -- Their call targets and registry phone snapshots remain separate.
  select public.log_clinic_call(
    gen_random_uuid(), null, 'yes', null, 'QA', null, null,
    'Broadway Clinic A', '10 BROADWAY SUITE 4', 'NEW YORK', 'NY', '10004',
    40.7100, -74.0100, '212-555-0101', 1, array['Family Medicine'],
    '1111111111', 'NPI-2'
  ) into v_target_a;
  select public.log_clinic_call(
    gen_random_uuid(), null, 'no', null, 'QA', null, null,
    'Broadway Clinic B', '10 BROADWAY SUITE 4', 'NEW YORK', 'NY', '10004',
    40.7100, -74.0100, '212-555-0102', 1, array['Family Medicine'],
    '2222222222', 'NPI-2'
  ) into v_target_b;

  v_shared_clinic := (v_target_a->'clinic'->>'id')::uuid;
  if v_shared_clinic <> (v_target_b->'clinic'->>'id')::uuid then
    raise exception 'identical full locations did not reuse the composite location row';
  end if;
  if v_target_a->'log'->>'target_npi' <> '1111111111'
     or v_target_a->'log'->>'target_phone' <> '212-555-0101'
     or v_target_b->'log'->>'target_npi' <> '2222222222'
     or v_target_b->'log'->>'target_phone' <> '212-555-0102' then
    raise exception 'same-location NPIs shared a call target or phone';
  end if;
  select * into v_clinic from public.clinics where id = v_shared_clinic;
  if v_clinic.status <> 'unknown' or v_clinic.phone is not null or v_clinic.npi is not null then
    raise exception 'NPI-specific outcomes or contact data were merged into the location pin';
  end if;

  select count(*) into v_log_count
  from public.contact_logs where clinic_id = v_shared_clinic;
  select public.report_clinic_contact(
    gen_random_uuid(), '1111111111', 'NPI-2', 'Broadway Clinic A',
    '212-555-0101', '10 BROADWAY SUITE 4', 'NEW YORK', 'NY', '10004', 'wrong_number'
  ) into v_report_wrong;
  select public.report_clinic_contact(
    gen_random_uuid(), '2222222222', 'NPI-2', 'Broadway Clinic B',
    '212-555-0102', '10 BROADWAY SUITE 4', 'NEW YORK', 'NY', '10004', 'practice_closed'
  ) into v_report_closed;

  select count(*) into v_report_count
  from public.contact_reports where clinic_id = v_shared_clinic;
  select count(*) into v_log_count
  from public.contact_logs where clinic_id = v_shared_clinic;
  if v_report_count <> 2 then raise exception 'contact reports were not stored separately'; end if;
  if v_log_count <> 2 then raise exception 'contact reports were counted as call outcomes'; end if;
  if v_report_wrong->>'reason' <> 'wrong_number'
     or v_report_closed->>'reason' <> 'practice_closed' then
    raise exception 'contact report reasons were not preserved';
  end if;
  select * into v_clinic from public.clinics where id = v_shared_clinic;
  if v_clinic.status <> 'unknown' then
    raise exception 'a contact report changed the map shadowing status';
  end if;
end;
$test$;

rollback;
