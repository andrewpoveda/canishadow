-- CanIShadow search and call logging are available nationwide. Keep this
-- allowlist in sync with src/lib/us-states.ts.
begin;

alter table public.clinics
  drop constraint if exists clinics_state_check;

alter table public.clinics
  add constraint clinics_state_check
  check (
    state in (
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
      'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
      'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
      'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
      'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
      'WY', 'AS', 'GU', 'MP', 'PR', 'VI'
    )
  ) not valid;

alter table public.clinics
  validate constraint clinics_state_check;

commit;
