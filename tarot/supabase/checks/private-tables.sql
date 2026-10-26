-- Metadata only: no account, session, reading, message or health records.
with table_security as (
select c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policy_count,
  has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as anon_table_access,
  has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES') as anon_column_access,
  has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as authenticated_table_access,
  has_any_column_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES') as authenticated_column_access,
  (has_table_privilege('service_role', c.oid, 'SELECT')
    and has_table_privilege('service_role', c.oid, 'INSERT')
    and has_table_privilege('service_role', c.oid, 'UPDATE')
    and has_table_privilege('service_role', c.oid, 'DELETE')) as service_crud
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'tarot_users', 'tarot_sessions', 'tarot_readings', 'tarot_messages', 'tarot_usage_counters'
)
order by c.relname
), fingerprints as (

-- A fingerprint verifies that other apps' table/column ACLs and policies did not
-- change. Only a digest is returned, not their policy definitions or data.
select md5(coalesce(string_agg(value, E'\n' order by value), '')) as other_apps_security_fingerprint
from (
  select concat_ws('|', n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text) as value
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
    and c.relname not in ('tarot_users', 'tarot_sessions', 'tarot_readings', 'tarot_messages', 'tarot_usage_counters')
  union all
  select concat_ws('|', c.relname, a.attname, a.attacl::text)
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and a.attacl is not null
    and c.relname not in ('tarot_users', 'tarot_sessions', 'tarot_readings', 'tarot_messages', 'tarot_usage_counters')
  union all
  select concat_ws('|', c.relname, p.polname, p.polcmd, p.polroles::text, p.polqual::text, p.polwithcheck::text)
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname not in ('tarot_users', 'tarot_sessions', 'tarot_readings', 'tarot_messages', 'tarot_usage_counters')
) metadata
)
select (select jsonb_agg(t) from table_security t) as tarot_tables,
  (select other_apps_security_fingerprint from fingerprints) as other_apps_security_fingerprint;
