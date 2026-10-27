-- Business conflicts must not use serialization_failure (40001):
-- PostgREST 14 retries that code indefinitely. Preserve ownership and row locks.
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
begin;
set local lock_timeout = '5s';

create or replace function public.tarot_create_manual_reading(p_input jsonb)
returns public.tarot_readings
language plpgsql set search_path = public, pg_temp as $fn$
declare
  v_id uuid := (p_input->>'id')::uuid;
  v_user uuid := (p_input->>'user_id')::uuid;
  v_anon text := nullif(p_input->>'anonymous_id', '');
  v_subject text;
  v_day date := (now() at time zone 'UTC')::date;
  v_used integer;
  v_limit integer;
  v_count integer;
  v_row public.tarot_readings;
begin
  if (v_user is null) = (v_anon is null) then raise exception 'invalid_owner' using errcode='22023'; end if;
  v_subject := case when v_user is not null then 'user:'||v_user else 'anon:'||v_anon end;
  v_limit := case when v_user is not null then 10 else 1 end;
  v_count := case p_input->>'spread_type'
    when 'single' then 1 when 'three_card' then 3 when 'five_cross' then 5
    when 'relation_dual' then 3 when 'choice_fork' then 3 when 'moon_triad' then 3 when 'celtic_cross' then 10 else 0 end;
  if v_id is null or v_count=0 or jsonb_typeof(p_input->'positions') is distinct from 'array' then
    raise exception 'invalid_draw' using errcode='22023';
  end if;
  if jsonb_array_length(p_input->'positions')<>v_count then
    raise exception 'invalid_positions' using errcode='22023';
  end if;
  -- Lock one owner's UTC-day counter before checking both idempotency and quota.
  insert into public.tarot_usage_counters(subject_key,day) values(v_subject,v_day) on conflict do nothing;
  select readings_count into v_used from public.tarot_usage_counters where subject_key=v_subject and day=v_day for update;
  select * into v_row from public.tarot_readings where id=v_id;
  if found then
    if v_row.deleted_at is not null or v_row.user_id is distinct from v_user or v_row.anonymous_id is distinct from v_anon
      or v_row.question is distinct from p_input->>'question' or v_row.spread_type is distinct from p_input->>'spread_type'
      or v_row.scene is distinct from p_input->>'scene' or v_row.detail_level is distinct from p_input->>'detail_level'
      or v_row.ritual_speed is distinct from p_input->>'ritual_speed'
      or v_row.silent_reveal is distinct from (p_input->>'silent_reveal')::boolean then
      raise exception 'request_conflict' using errcode='P0001';
    end if;
    return v_row;
  end if;
  if v_used>=v_limit then raise exception 'reading_quota' using errcode='P0001'; end if;
  insert into public.tarot_readings(id,user_id,anonymous_id,title,question,scene,spread_type,spread_result,status,detail_level,ritual_speed,silent_reveal,draw_state)
  values(v_id,v_user,v_anon,left(p_input->>'question',24),p_input->>'question',p_input->>'scene',p_input->>'spread_type',
    jsonb_build_object('spread',p_input->>'spread_type','cards','[]'::jsonb),'drawing',p_input->>'detail_level',p_input->>'ritual_speed',
    (p_input->>'silent_reveal')::boolean,
    jsonb_build_object('version',1,'positions',p_input->'positions','cutIndex',null,'selected','[]'::jsonb,'picked','[]'::jsonb,'revision',0))
  returning * into v_row;
  update public.tarot_usage_counters set readings_count=readings_count+1 where subject_key=v_subject and day=v_day;
  return v_row;
end
$fn$;

create or replace function public.tarot_apply_draw(
  p_id uuid, p_user_id uuid, p_anonymous_id text, p_action text, p_revision integer,
  p_cut_index integer default null, p_selected integer[] default null, p_candidates jsonb default null
)
returns public.tarot_readings
language plpgsql set search_path = public, pg_temp as $fn$
declare
  v_row public.tarot_readings;
  v_state jsonb;
  v_cut integer;
  v_selected integer[];
  v_result jsonb;
  v_picked jsonb := '[]'::jsonb;
  v_card jsonb;
  v_index integer;
  v_used text[];
begin
  select * into v_row from public.tarot_readings where id=p_id and deleted_at is null for update;
  if not found then raise exception 'not_found' using errcode='P0002'; end if;
  if not coalesce(((p_user_id is not null and v_row.user_id=p_user_id)
    or (p_user_id is null and v_row.user_id is null and p_anonymous_id is not null and v_row.anonymous_id=p_anonymous_id)),false) then
    raise exception 'not_found' using errcode='P0002';
  end if;
  v_state := v_row.draw_state;
  -- A lost confirmation response may be retried, but never rerolls a result.
  if (v_state is null or v_state->>'completed'='true') and p_action='confirm' and jsonb_array_length(v_row.spread_result->'cards')>0 then return v_row; end if;
  if v_state is null or v_row.status<>'drawing' then raise exception 'draw_locked' using errcode='22023'; end if;
  if p_revision is distinct from (v_state->>'revision')::integer then raise exception 'draw_conflict' using errcode='P0001'; end if;
  v_cut := (v_state->>'cutIndex')::integer;
  if p_action='cut' then
    if v_cut is not null or p_cut_index is null or p_cut_index<1 or p_cut_index>77 then raise exception 'invalid_cut' using errcode='22023'; end if;
    v_state := jsonb_set(v_state,'{cutIndex}',to_jsonb(p_cut_index));
  elsif p_action='select' then
    if v_cut is null or p_selected is null or coalesce(array_ndims(p_selected),1)<>1
      or cardinality(p_selected)>jsonb_array_length(v_state->'positions')
      or exists(select 1 from unnest(p_selected) i where i is null or i<0 or i>77)
      or (select count(distinct i) from unnest(p_selected) i)<>cardinality(p_selected) then
      raise exception 'invalid_selection' using errcode='22023';
    end if;
    if jsonb_typeof(p_candidates) is distinct from 'array' then raise exception 'invalid_candidates' using errcode='22023'; end if;
    if jsonb_array_length(p_candidates)<>78
      or (select count(distinct c->>'cardId') from jsonb_array_elements(p_candidates) c)<>78
      or exists(select 1 from jsonb_array_elements(p_candidates) c where jsonb_typeof(c->'reversed') is distinct from 'boolean') then
      raise exception 'invalid_candidates' using errcode='22023';
    end if;
    -- Fresh, cryptographically shuffled candidates come from the server at the
    -- time of this click. Fan indices and the visual cut never choose a face.
    select coalesce(array_agg(c->>'cardId'), '{}'::text[]) into v_used
      from jsonb_array_elements(v_state->'picked') c where (c->>'index')::integer=any(p_selected);
    foreach v_index in array p_selected loop
      select c into v_card from jsonb_array_elements(v_state->'picked') c where (c->>'index')::integer=v_index;
      if v_card is null then
        select c into v_card from jsonb_array_elements(p_candidates) c where not(c->>'cardId'=any(v_used)) limit 1;
      end if;
      if v_card is null then raise exception 'invalid_candidates' using errcode='22023'; end if;
      v_used := array_append(v_used,v_card->>'cardId');
      v_picked := v_picked || jsonb_build_array(v_card || jsonb_build_object('index',v_index));
    end loop;
    v_state := jsonb_set(jsonb_set(v_state,'{selected}',to_jsonb(p_selected)),'{picked}',v_picked);
  elsif p_action='confirm' then
    select coalesce(array_agg(value::integer order by ord), '{}'::integer[]) into v_selected
      from jsonb_array_elements_text(v_state->'selected') with ordinality a(value,ord);
    if v_cut is null or cardinality(v_selected)<>jsonb_array_length(v_state->'positions')
      or jsonb_array_length(v_state->'picked')<>cardinality(v_selected) then
      raise exception 'selection_incomplete' using errcode='22023';
    end if;
    select jsonb_agg(jsonb_build_object(
      'position',pos->>'position','positionLabel',pos->>'positionLabel',
      'cardId',(select c->>'cardId' from jsonb_array_elements(v_state->'picked') c where (c->>'index')::integer=v_selected[ord::integer]),
      'reversed',(select c->'reversed' from jsonb_array_elements(v_state->'picked') c where (c->>'index')::integer=v_selected[ord::integer])
    ) order by ord) into v_result
    from jsonb_array_elements(v_state->'positions') with ordinality a(pos,ord);
    update public.tarot_readings set draw_state=jsonb_build_object('version',1,'completed',true,'cutIndex',v_cut,'selected',to_jsonb(v_selected)),status='revealed',
      spread_result=jsonb_build_object('spread',v_row.spread_type,'cards',v_result),updated_at=now()
      where id=p_id returning * into v_row;
    return v_row;
  else raise exception 'invalid_action' using errcode='22023';
  end if;
  v_state := jsonb_set(v_state,'{revision}',to_jsonb((v_state->>'revision')::integer+1));
  update public.tarot_readings set draw_state=v_state,updated_at=now() where id=p_id returning * into v_row;
  return v_row;
end
$fn$;

-- CREATE OR REPLACE retains the service-only function privileges.
notify pgrst, 'reload schema';
commit;
