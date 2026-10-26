-- Tarot uses application sessions, not Supabase Auth JWTs. These tables must
-- only be reached by the server-side service_role client. An anon key from any
-- other app in the same project must not provide access to Tarot data.
-- Additive, rerunnable hardening: no rows, schemas, or shared defaults change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tarot_users enable row level security;
alter table public.tarot_sessions enable row level security;
alter table public.tarot_readings enable row level security;
alter table public.tarot_messages enable row level security;
alter table public.tarot_usage_counters enable row level security;

revoke all privileges on table
  public.tarot_users,
  public.tarot_sessions,
  public.tarot_readings,
  public.tarot_messages,
  public.tarot_usage_counters
from public, anon, authenticated;

-- REVOKE on a table does not remove independently granted column privileges.
-- Remove those too, together with any older client-access RLS policies.
do $hardening$
declare
  target regclass;
  column_names text;
  old_policy record;
begin
  foreach target in array array[
    'public.tarot_users'::regclass,
    'public.tarot_sessions'::regclass,
    'public.tarot_readings'::regclass,
    'public.tarot_messages'::regclass,
    'public.tarot_usage_counters'::regclass
  ] loop
    select string_agg(format('%I', attname), ', ' order by attnum)
      into column_names
      from pg_attribute
      where attrelid = target and attnum > 0 and not attisdropped;
    execute format(
      'revoke all privileges (%s) on table %s from public, anon, authenticated',
      column_names, target
    );
    for old_policy in select polname from pg_policy where polrelid = target loop
      execute format('drop policy %I on %s', old_policy.polname, target);
    end loop;
  end loop;
end
$hardening$;

grant select, insert, update, delete on table
  public.tarot_users,
  public.tarot_sessions,
  public.tarot_readings,
  public.tarot_messages,
  public.tarot_usage_counters
to service_role;

-- Fail the entire transaction if inherited privileges keep a client role open.
do $verify$
declare
  target regclass;
  client_role text;
begin
  foreach target in array array[
    'public.tarot_users'::regclass,
    'public.tarot_sessions'::regclass,
    'public.tarot_readings'::regclass,
    'public.tarot_messages'::regclass,
    'public.tarot_usage_counters'::regclass
  ] loop
    foreach client_role in array array['anon', 'authenticated'] loop
      if has_table_privilege(client_role, target, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege(client_role, target, 'SELECT, INSERT, UPDATE, REFERENCES') then
        raise exception 'Unexpected remaining client privileges on % for %', target, client_role;
      end if;
    end loop;
  end loop;
end
$verify$;

notify pgrst, 'reload schema';
commit;
