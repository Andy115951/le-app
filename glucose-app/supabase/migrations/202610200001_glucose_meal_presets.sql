-- Add only reusable meal combinations for the glucose app in the shared project.
-- Safe to rerun; existing meals, Auth settings and other apps are untouched.
begin;

create table if not exists public.glucose_meal_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id uuid not null,
  name text not null constraint glucose_meal_presets_name_check check (char_length(btrim(name)) between 1 and 60),
  meal_type text not null constraint glucose_meal_presets_type_check check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  items jsonb not null constraint glucose_meal_presets_items_check check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint glucose_meal_presets_profile_fk foreign key (profile_id, user_id) references public.glucose_profiles(id, user_id) on delete cascade
);

create or replace function public.glucose_validate_meal_preset()
returns trigger language plpgsql set search_path = '' as $$
declare
  item jsonb;
  snapshot jsonb;
  seen_ids text[] := '{}';
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.profile_id is distinct from old.profile_id) then
    raise exception 'A meal preset cannot be transferred between users or members' using errcode = '23514';
  end if;
  new.name := btrim(new.name);
  if new.name is null or char_length(new.name) not between 1 and 60 then
    raise exception 'A meal preset needs a name of 1 to 60 characters' using errcode = '23514';
  end if;
  if jsonb_typeof(new.items) is distinct from 'array' then
    raise exception 'Meal preset items must be an array' using errcode = '23514';
  end if;
  if jsonb_array_length(new.items) not between 1 and 100 then
    raise exception 'A meal preset needs 1 to 100 food items' using errcode = '23514';
  end if;
  for item in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item -> 'id') is distinct from 'string'
       or char_length(btrim(item ->> 'id')) not between 1 and 200
       or jsonb_typeof(item -> 'name') is distinct from 'string'
       or char_length(btrim(item ->> 'name')) not between 1 and 200
       or jsonb_typeof(item -> 'unit') is distinct from 'string'
       or char_length(btrim(item ->> 'unit')) not between 1 and 80 then
      raise exception 'Each preset item needs an ID, food name and unit' using errcode = '23514';
    end if;
    if (item ->> 'id') = any(seen_ids) then
      raise exception 'Preset item IDs must be unique' using errcode = '23514';
    end if;
    seen_ids := array_append(seen_ids, item ->> 'id');
    if jsonb_typeof(item -> 'quantity') is distinct from 'number' then
      raise exception 'Preset item quantity must be a positive number' using errcode = '23514';
    end if;
    if (item ->> 'quantity')::numeric <= 0 then
      raise exception 'Preset item quantity must be a positive number' using errcode = '23514';
    end if;
    if jsonb_typeof(item -> 'grams') = 'number' then
      if (item ->> 'grams')::numeric <= 0 then
        raise exception 'Preset item grams must be positive when supplied' using errcode = '23514';
      end if;
    elsif jsonb_typeof(item -> 'grams') is distinct from 'null' then
      raise exception 'Preset item grams must be a number or null' using errcode = '23514';
    end if;
    if jsonb_typeof(item -> 'foodId') = 'string' then
      if char_length(btrim(item ->> 'foodId')) not between 1 and 200 then
        raise exception 'Preset food reference is invalid' using errcode = '23514';
      end if;
    elsif jsonb_typeof(item -> 'foodId') is distinct from 'null' then
      raise exception 'Preset food reference must be a string or null' using errcode = '23514';
    end if;
    if item ? 'foodSnapshot' then
      snapshot := item -> 'foodSnapshot';
      if jsonb_typeof(snapshot) is distinct from 'object'
         or jsonb_typeof(snapshot -> 'giStatus') is distinct from 'string'
         or (snapshot ->> 'giStatus') not in ('known', 'unknown', 'not-applicable') then
        raise exception 'Preset food snapshot is invalid' using errcode = '23514';
      end if;
      if jsonb_typeof(snapshot -> 'gi') = 'number' then
        if (snapshot ->> 'gi')::numeric < 0 or (snapshot ->> 'giStatus') <> 'known' then
          raise exception 'Preset GI must agree with its status' using errcode = '23514';
        end if;
      elsif jsonb_typeof(snapshot -> 'gi') is distinct from 'null' or (snapshot ->> 'giStatus') = 'known' then
        raise exception 'Preset GI must agree with its status' using errcode = '23514';
      end if;
      if jsonb_typeof(snapshot -> 'availableCarbsPer100g') = 'number' then
        if (snapshot ->> 'availableCarbsPer100g')::numeric not between 0 and 100 then
          raise exception 'Preset available carbohydrate is invalid' using errcode = '23514';
        end if;
      elsif jsonb_typeof(snapshot -> 'availableCarbsPer100g') is distinct from 'null' then
        raise exception 'Preset available carbohydrate must be a number or null' using errcode = '23514';
      end if;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.glucose_validate_meal_preset() from public, anon, authenticated;

create index if not exists glucose_meal_presets_owner_created_idx on public.glucose_meal_presets(user_id, profile_id, created_at desc, id);
drop trigger if exists glucose_meal_presets_updated on public.glucose_meal_presets;
create trigger glucose_meal_presets_updated before update on public.glucose_meal_presets for each row execute function public.glucose_touch_updated_at();
drop trigger if exists glucose_meal_presets_validate on public.glucose_meal_presets;
create trigger glucose_meal_presets_validate before insert or update on public.glucose_meal_presets for each row execute function public.glucose_validate_meal_preset();

alter table public.glucose_meal_presets enable row level security;
revoke all on public.glucose_meal_presets from public, anon, authenticated;
grant select, insert, update, delete on public.glucose_meal_presets to authenticated;
grant all on public.glucose_meal_presets to service_role;
drop policy if exists glucose_meal_presets_owner on public.glucose_meal_presets;
create policy glucose_meal_presets_owner on public.glucose_meal_presets for all to authenticated
  using (user_id = (select auth.uid()) and (select public.glucose_has_access()))
  with check (user_id = (select auth.uid()) and (select public.glucose_has_access()));

commit;
