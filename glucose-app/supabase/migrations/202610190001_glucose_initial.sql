-- Additive migration for the glucose app in the shared Supabase project.
-- No existing app objects, Auth settings, or global default privileges change.
begin;

create table public.glucose_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' constraint glucose_accounts_status_check check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The only SECURITY DEFINER function returns the current user's own access flag.
-- A fixed empty search path prevents name shadowing; no caller-supplied user ID.
create function public.glucose_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.glucose_accounts
    where user_id = (select auth.uid()) and status = 'active'
  );
$$;
revoke all on function public.glucose_has_access() from public, anon;
grant execute on function public.glucose_has_access() to authenticated, service_role;

create function public.glucose_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.glucose_touch_updated_at() from public, anon, authenticated;

create table public.glucose_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null constraint glucose_profiles_name_check check (char_length(btrim(name)) between 1 and 80),
  timezone text not null default 'Asia/Shanghai' constraint glucose_profiles_timezone_length_check check (char_length(timezone) between 1 and 100),
  unit text not null default 'mmol/L' constraint glucose_profiles_unit_check check (unit in ('mmol/L', 'mg/dL')),
  allergies text[] not null default '{}',
  avoidances text[] not null default '{}',
  preferences text[] not null default '{}',
  max_cooking_minutes integer constraint glucose_profiles_cooking_check check (max_cooking_minutes between 1 and 1440),
  targets jsonb not null default '{}'::jsonb constraint glucose_profiles_targets_check check (jsonb_typeof(targets) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint glucose_profiles_owner_unique unique (id, user_id)
);

create function public.glucose_validate_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown profile timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.glucose_validate_profile() from public, anon, authenticated;

create table public.glucose_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null,
  meal_type text not null constraint glucose_meals_type_check check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  started_at timestamptz not null,
  note text not null default '' constraint glucose_meals_note_check check (char_length(note) <= 4000),
  template_id text constraint glucose_meals_template_check check (char_length(template_id) between 1 and 200),
  -- JSON items retain the app's camelCase schema and the food snapshot at recording.
  items jsonb not null default '[]'::jsonb constraint glucose_meals_items_check check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint glucose_meals_profile_fk foreign key (profile_id, user_id) references public.glucose_profiles(id, user_id) on delete cascade,
  constraint glucose_meals_owner_profile_unique unique (id, user_id, profile_id)
);

create function public.glucose_validate_meal_items()
returns trigger language plpgsql set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) > 100 then
    raise exception 'Meal items must be an array with at most 100 entries' using errcode = '23514';
  end if;
  for item in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item -> 'name') is distinct from 'string'
       or char_length(btrim(item ->> 'name')) not between 1 and 200 then
      raise exception 'Each meal item needs a nonempty name' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.glucose_validate_meal_items() from public, anon, authenticated;

create table public.glucose_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null,
  value numeric(12, 4),
  unit text not null default 'mmol/L' constraint glucose_readings_unit_check check (unit in ('mmol/L', 'mg/dL')),
  value_mmol numeric generated always as (case when value is null then null when unit = 'mg/dL' then round(value / 18.0, 4) else value end) stored,
  special text constraint glucose_readings_special_check check (special in ('HI', 'LO')),
  measured_at timestamptz not null,
  context text not null constraint glucose_readings_context_check check (context in ('fasting', 'before-meal', 'after-meal', 'bedtime', 'random')),
  meal_id uuid,
  post_meal_minutes integer constraint glucose_readings_minutes_check check (post_meal_minutes >= 0),
  timing_source text not null default 'unknown' constraint glucose_readings_timing_check check (timing_source in ('calculated', 'manual', 'unknown')),
  note text not null default '' constraint glucose_readings_note_check check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint glucose_readings_value_check check ((value is not null and value > 0 and value <> 'NaN'::numeric and special is null) or (value is null and special is not null)),
  constraint glucose_readings_profile_fk foreign key (profile_id, user_id) references public.glucose_profiles(id, user_id) on delete cascade,
  constraint glucose_readings_meal_fk foreign key (meal_id, user_id, profile_id) references public.glucose_meals(id, user_id, profile_id),
  constraint glucose_readings_interval_check check (
    (context = 'after-meal' and ((post_meal_minutes is null and timing_source = 'unknown') or (post_meal_minutes is not null and timing_source in ('calculated', 'manual'))))
    or (context <> 'after-meal' and post_meal_minutes is null and timing_source = 'unknown')
  )
);

-- Enforce time semantics even if a client bypasses the form or provides a fake interval.
create function public.glucose_normalize_reading()
returns trigger language plpgsql set search_path = '' as $$
declare meal_start timestamptz;
begin
  if new.context <> 'after-meal' then
    new.post_meal_minutes := null;
    new.timing_source := 'unknown';
    return new;
  end if;
  if new.meal_id is not null then
    select started_at into meal_start from public.glucose_meals
      where id = new.meal_id and user_id = new.user_id and profile_id = new.profile_id;
    if not found then
      raise exception 'Linked meal must belong to the same user and member' using errcode = '23503';
    end if;
    if new.measured_at < meal_start then
      raise exception 'After-meal measurement cannot precede meal start' using errcode = '23514';
    end if;
    new.post_meal_minutes := round(extract(epoch from (new.measured_at - meal_start)) / 60)::integer;
    new.timing_source := 'calculated';
  elsif new.post_meal_minutes is null then
    new.timing_source := 'unknown';
  elsif tg_op = 'UPDATE' and old.timing_source = 'calculated'
        and old.post_meal_minutes is not distinct from new.post_meal_minutes
        and old.measured_at is not distinct from new.measured_at
        and old.context = new.context then
    -- Unlinking/deleting a meal preserves the measured interval and its provenance.
    new.timing_source := 'calculated';
  else
    new.timing_source := 'manual';
  end if;
  return new;
end;
$$;
revoke all on function public.glucose_normalize_reading() from public, anon, authenticated;

create function public.glucose_unlink_deleted_meal()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.glucose_readings set meal_id = null
  where meal_id = old.id and user_id = old.user_id and profile_id = old.profile_id;
  return old;
end;
$$;
revoke all on function public.glucose_unlink_deleted_meal() from public, anon, authenticated;

create function public.glucose_refresh_meal_intervals()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.started_at is distinct from old.started_at then
    update public.glucose_readings set meal_id = new.id
    where meal_id = new.id and user_id = new.user_id and profile_id = new.profile_id and context = 'after-meal';
  end if;
  return new;
end;
$$;
revoke all on function public.glucose_refresh_meal_intervals() from public, anon, authenticated;

create table public.glucose_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null,
  kind text not null constraint glucose_favorites_kind_check check (kind in ('food', 'template')),
  reference_id text not null constraint glucose_favorites_reference_check check (char_length(reference_id) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint glucose_favorites_profile_fk foreign key (profile_id, user_id) references public.glucose_profiles(id, user_id) on delete cascade,
  constraint glucose_favorites_member_reference_unique unique (user_id, profile_id, kind, reference_id)
);

create index glucose_profiles_owner_idx on public.glucose_profiles(user_id, created_at);
create index glucose_meals_owner_date_idx on public.glucose_meals(user_id, profile_id, started_at desc);
create index glucose_readings_owner_date_idx on public.glucose_readings(user_id, profile_id, measured_at desc);
create index glucose_readings_meal_idx on public.glucose_readings(meal_id) where meal_id is not null;
create index glucose_favorites_owner_idx on public.glucose_favorites(user_id, profile_id);

create trigger glucose_accounts_updated before update on public.glucose_accounts for each row execute function public.glucose_touch_updated_at();
create trigger glucose_profiles_updated before update on public.glucose_profiles for each row execute function public.glucose_touch_updated_at();
create trigger glucose_profiles_validate before insert or update on public.glucose_profiles for each row execute function public.glucose_validate_profile();
create trigger glucose_meals_updated before update on public.glucose_meals for each row execute function public.glucose_touch_updated_at();
create trigger glucose_meals_validate before insert or update on public.glucose_meals for each row execute function public.glucose_validate_meal_items();
create trigger glucose_meals_unlink before delete on public.glucose_meals for each row execute function public.glucose_unlink_deleted_meal();
create trigger glucose_meals_refresh after update of started_at on public.glucose_meals for each row execute function public.glucose_refresh_meal_intervals();
create trigger glucose_readings_updated before update on public.glucose_readings for each row execute function public.glucose_touch_updated_at();
create trigger glucose_readings_normalize before insert or update on public.glucose_readings for each row execute function public.glucose_normalize_reading();
create trigger glucose_favorites_updated before update on public.glucose_favorites for each row execute function public.glucose_touch_updated_at();

alter table public.glucose_accounts enable row level security;
alter table public.glucose_profiles enable row level security;
alter table public.glucose_meals enable row level security;
alter table public.glucose_readings enable row level security;
alter table public.glucose_favorites enable row level security;

-- Shared-project defaults may grant broad access: replace grants for these objects only.
revoke all on public.glucose_accounts, public.glucose_profiles, public.glucose_meals, public.glucose_readings, public.glucose_favorites from public, anon, authenticated;
grant select on public.glucose_accounts to authenticated;
grant select, insert, update, delete on public.glucose_profiles, public.glucose_meals, public.glucose_readings, public.glucose_favorites to authenticated;
grant all on public.glucose_accounts, public.glucose_profiles, public.glucose_meals, public.glucose_readings, public.glucose_favorites to service_role;

create policy glucose_accounts_read_self on public.glucose_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy glucose_profiles_owner on public.glucose_profiles for all to authenticated
  using (user_id = (select auth.uid()) and (select public.glucose_has_access()))
  with check (user_id = (select auth.uid()) and (select public.glucose_has_access()));
create policy glucose_meals_owner on public.glucose_meals for all to authenticated
  using (user_id = (select auth.uid()) and (select public.glucose_has_access()))
  with check (user_id = (select auth.uid()) and (select public.glucose_has_access()));
create policy glucose_readings_owner on public.glucose_readings for all to authenticated
  using (user_id = (select auth.uid()) and (select public.glucose_has_access()))
  with check (user_id = (select auth.uid()) and (select public.glucose_has_access()));
create policy glucose_favorites_owner on public.glucose_favorites for all to authenticated
  using (user_id = (select auth.uid()) and (select public.glucose_has_access()))
  with check (user_id = (select auth.uid()) and (select public.glucose_has_access()));

commit;
