#!/usr/bin/env node
// Runs the actual migration and RLS policies in an ephemeral PostgreSQL instance.
// No Supabase connection, credentials, or persistent health data are used.
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.GLUCOSE_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let assertions = 0;
const ids = {
  a: '10000000-0000-4000-8000-000000000001',
  b: '10000000-0000-4000-8000-000000000002',
  unadmitted: '10000000-0000-4000-8000-000000000003',
  pa: '20000000-0000-4000-8000-000000000001',
  pa2: '20000000-0000-4000-8000-000000000002',
  pb: '20000000-0000-4000-8000-000000000003',
  meal: '30000000-0000-4000-8000-000000000001',
  reading: '40000000-0000-4000-8000-000000000001',
  preset: '50000000-0000-4000-8000-000000000001',
};
function assert(condition, label) {
  if (!condition) throw new Error(`Failed: ${label}`);
  assertions += 1;
}
async function rows(sql, params = []) { return (await db.query(sql, params)).rows; }
async function denied(sql, params, label, codes = ['42501', '23503', '23514', '23505', '428C9']) {
  try { await db.query(sql, params); }
  catch (error) {
    assert(codes.includes(error.code), `${label}: expected constraint/permission rejection, received ${error.code}`);
    return;
  }
  throw new Error(`Failed: ${label}: statement unexpectedly succeeded`);
}
async function as(role, user = '') {
  await db.exec('reset role');
  await db.exec(`set role ${role}`); // role names are constants controlled by this file.
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202610190001_glucose_initial.sql', import.meta.url), 'utf8'));
  assert((await rows("select count(*)::int as count from pg_tables where tablename like 'glucose_%' and rowsecurity"))[0].count === 5, 'all private tables enable RLS');
  const presetMigration = await readFile(new URL('../supabase/migrations/202610200001_glucose_meal_presets.sql', import.meta.url), 'utf8');
  await db.exec(presetMigration);
  await db.exec(presetMigration);
  assert((await rows("select count(*)::int as count from pg_tables where tablename like 'glucose_%' and rowsecurity"))[0].count === 6, 'incremental preset migration is rerunnable and adds one private table');
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [ids.a, ids.b, ids.unadmitted]);
  await db.query('insert into public.glucose_accounts(user_id) values ($1),($2)', [ids.a, ids.b]);
  await as('anon');
  for (const table of ['glucose_accounts', 'glucose_profiles', 'glucose_meals', 'glucose_readings', 'glucose_favorites', 'glucose_meal_presets']) {
    await denied(`select * from public.${table}`, [], `anonymous cannot read ${table}`);
  }
  await as('authenticated', ids.unadmitted);
  assert((await rows('select * from public.glucose_profiles')).length === 0, 'unadmitted user cannot see profiles');
  await denied('insert into public.glucose_profiles(name) values ($1)', ['Unadmitted'], 'unadmitted user cannot create profile');
  await denied('insert into public.glucose_accounts(user_id) values ($1)', [ids.unadmitted], 'user cannot self-enroll');
  await denied('update public.glucose_accounts set status=$1 where user_id=$2', ['active', ids.unadmitted], 'user cannot enable own account');
  await as('authenticated', ids.a);
  assert((await rows('select * from public.glucose_accounts')).length === 1, 'account visibility limited to self');
  await db.query('insert into public.glucose_profiles(id,name) values ($1,$2),($3,$4)', [ids.pa, 'A', ids.pa2, 'A family']);
  assert((await rows('select user_id from public.glucose_profiles where id=$1', [ids.pa]))[0].user_id === ids.a, 'profile owner defaults to JWT identity');
  await denied('insert into public.glucose_profiles(name,user_id) values ($1,$2)', ['Forged', ids.b], 'cannot forge profile owner');
  await denied('insert into public.glucose_profiles(name,timezone) values ($1,$2)', ['Wrong timezone', 'Made/Up'], 'timezone must be recognized');
  await as('authenticated', ids.b);
  await db.query('insert into public.glucose_profiles(id,name) values ($1,$2)', [ids.pb, 'B']);
  assert((await rows('select * from public.glucose_profiles where id=$1', [ids.pa])).length === 0, 'B cannot read A profile');
  assert((await rows('update public.glucose_profiles set name=$1 where id=$2 returning id', ['Tampered', ids.pa])).length === 0, 'B cannot update A profile');
  assert((await rows('delete from public.glucose_profiles where id=$1 returning id', [ids.pa])).length === 0, 'B cannot delete A profile');
  await as('authenticated', ids.a);
  const item = JSON.stringify([{ id: 'item-1', foodId: null, name: 'Synthetic rice', quantity: 1, unit: '碗', grams: null }]);
  await db.query('insert into public.glucose_meals(id,profile_id,meal_type,started_at,items) values ($1,$2,$3,$4,$5)', [ids.meal, ids.pa, 'lunch', '2026-10-19T04:00:00Z', item]);
  await denied('insert into public.glucose_meals(profile_id,meal_type,started_at) values ($1,$2,$3)', [ids.pb, 'lunch', '2026-10-19T04:00:00Z'], 'meal cannot use foreign account profile');
  await denied('insert into public.glucose_meals(profile_id,meal_type,started_at,items) values ($1,$2,$3,$4)', [ids.pa, 'lunch', '2026-10-19T04:00:00Z', '[{"name":""}]'], 'meal item needs a name');
  await db.query('insert into public.glucose_readings(id,profile_id,value,unit,context,meal_id,measured_at,post_meal_minutes,timing_source) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [ids.reading, ids.pa, 108, 'mg/dL', 'after-meal', ids.meal, '2026-10-19T06:00:00Z', 1, 'manual']);
  let reading = (await rows('select * from public.glucose_readings where id=$1', [ids.reading]))[0];
  assert(Number(reading.value_mmol) === 6, 'generated canonical value uses raw input and unit');
  assert(reading.post_meal_minutes === 120 && reading.timing_source === 'calculated', 'linked interval computed from actual times');
  await denied('update public.glucose_readings set value_mmol=99 where id=$1', [ids.reading], 'canonical value cannot be overwritten');
  await denied('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,7,$2,$3,$4)', [ids.pa2, 'after-meal', ids.meal, '2026-10-19T06:00:00Z'], 'cross-member meal association rejected');
  await denied('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,7,$2,$3,$4)', [ids.pa, 'after-meal', ids.meal, '2026-10-19T03:59:00Z'], 'negative post-meal interval rejected');
  await denied('update public.glucose_readings set user_id=$1,profile_id=$2 where id=$3', [ids.b, ids.pb, ids.reading], 'cannot transfer measurement ownership');
  await as('authenticated', ids.b);
  assert((await rows('select * from public.glucose_readings where id=$1', [ids.reading])).length === 0, 'B cannot read A measurement');
  assert((await rows('delete from public.glucose_meals where id=$1 returning id', [ids.meal])).length === 0, 'B cannot delete A meal');
  await denied('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,7,$2,$3,$4)', [ids.pb, 'after-meal', ids.meal, '2026-10-19T06:00:00Z'], 'cross-account meal association rejected');
  await as('authenticated', ids.a);
  await db.query('update public.glucose_meals set started_at=$1 where id=$2', ['2026-10-19T04:30:00Z', ids.meal]);
  reading = (await rows('select * from public.glucose_readings where id=$1', [ids.reading]))[0];
  assert(reading.post_meal_minutes === 90, 'editing meal start recalculates intervals');
  await denied('update public.glucose_meals set started_at=$1 where id=$2', ['2026-10-19T06:01:00Z', ids.meal], 'conflicting meal time edit rejected');
  assert(new Date((await rows('select started_at from public.glucose_meals where id=$1', [ids.meal]))[0].started_at).toISOString() === '2026-10-19T04:30:00.000Z', 'conflicting edit leaves previous meal time intact');
  const manual = (await rows('insert into public.glucose_readings(profile_id,value,context,measured_at,post_meal_minutes,timing_source) values ($1,7.1,$2,$3,85,$4) returning *', [ids.pa, 'after-meal', '2026-10-19T08:00:00Z', 'calculated']))[0];
  assert(manual.timing_source === 'manual', 'unlinked new interval cannot claim calculated provenance');
  const special = (await rows('insert into public.glucose_readings(profile_id,special,context,measured_at) values ($1,$2,$3,$4) returning *', [ids.pa, 'HI', 'random', '2026-10-19T09:00:00Z']))[0];
  assert(special.value === null && special.value_mmol === null, 'HI preserves absence of numeric measurement');
  await denied('insert into public.glucose_readings(profile_id,value,special,context,measured_at) values ($1,3,$2,$3,$4)', [ids.pa, 'LO', 'random', '2026-10-19T09:00:00Z'], 'special and numeric readings are exclusive');
  await denied('insert into public.glucose_readings(profile_id,value,context,measured_at) values ($1,$2,$3,$4)', [ids.pa, 'NaN', 'random', '2026-10-19T09:00:00Z'], 'PostgreSQL numeric NaN is not a measurement');
  const before = (await rows('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,5,$2,$3,$4) returning *', [ids.pa, 'before-meal', ids.meal, '2026-10-19T03:55:00Z']))[0];
  assert(before.post_meal_minutes === null && before.timing_source === 'unknown', 'before-meal association does not invent an after-meal interval');
  await denied('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,5,$2,$3,$4)', [ids.pa2, 'before-meal', ids.meal, '2026-10-19T03:55:00Z'], 'composite foreign key blocks cross-member before-meal link');
  await db.query('insert into public.glucose_favorites(profile_id,kind,reference_id) values ($1,$2,$3)', [ids.pa, 'food', 'test-rice']);
  await denied('insert into public.glucose_favorites(profile_id,kind,reference_id) values ($1,$2,$3)', [ids.pa, 'food', 'test-rice'], 'duplicate favorites rejected');
  await denied('insert into public.glucose_favorites(profile_id,kind,reference_id) values ($1,$2,$3)', [ids.pb, 'food', 'test-rice'], 'favorite cannot point to foreign profile');
  await db.query('delete from public.glucose_meals where id=$1', [ids.meal]);
  reading = (await rows('select * from public.glucose_readings where id=$1', [ids.reading]))[0];
  assert(reading.meal_id === null && reading.post_meal_minutes === 90 && reading.timing_source === 'calculated', 'meal deletion preserves measurement and provenance');
  await db.query('update public.glucose_readings set note=$1 where id=$2', ['Still calculated historically', ids.reading]);
  assert((await rows('select timing_source from public.glucose_readings where id=$1', [ids.reading]))[0].timing_source === 'calculated', 'note edit preserves original calculated provenance');
  await db.query('update public.glucose_readings set post_meal_minutes=95 where id=$1', [ids.reading]);
  assert((await rows('select timing_source from public.glucose_readings where id=$1', [ids.reading]))[0].timing_source === 'manual', 'editing historical interval switches provenance to manual');
  const presetItem = { id: 'preset-item-1', foodId: 'rice-white', name: 'Saved synthetic rice', quantity: 0.5, unit: '碗', grams: 115, foodSnapshot: { gi: 83, giStatus: 'known', availableCarbsPer100g: 21.74 } };
  const presetItems = JSON.stringify([presetItem]);
  const mealCount = (await rows('select count(*)::int as count from public.glucose_meals'))[0].count;
  await db.query('insert into public.glucose_meal_presets(id,profile_id,name,meal_type,items) values ($1,$2,$3,$4,$5)', [ids.preset, ids.pa, '  Everyday breakfast  ', 'breakfast', presetItems]);
  const savedPreset = (await rows('select * from public.glucose_meal_presets where id=$1', [ids.preset]))[0];
  assert(savedPreset.user_id === ids.a && savedPreset.profile_id === ids.pa, 'preset owner defaults to current user and retains member');
  assert(savedPreset.name === 'Everyday breakfast', 'preset name is trimmed before saving');
  assert((await rows('select count(*)::int as count from public.glucose_meals'))[0].count === mealCount, 'saving a preset does not insert a dated meal');
  const appliedItems = JSON.stringify([{ ...presetItem, id: 'applied-item-1' }]);
  const appliedMeal = (await rows('insert into public.glucose_meals(profile_id,meal_type,started_at,items) values ($1,$2,$3,$4) returning id', [ids.pa, 'breakfast', '2026-10-20T00:00:00Z', appliedItems]))[0];
  await db.query('update public.glucose_meals set items=$1 where id=$2', [JSON.stringify([{ ...presetItem, id: 'applied-item-1', name: 'Edited meal only', quantity: 2, foodSnapshot: { ...presetItem.foodSnapshot, gi: 50 } }]), appliedMeal.id]);
  assert((await rows('select items from public.glucose_meal_presets where id=$1', [ids.preset]))[0].items[0].quantity === 0.5, 'editing an applied meal does not change saved preset quantities');
  await db.query('update public.glucose_meal_presets set name=$1,items=$2,created_at=$3,updated_at=$3 where id=$4', ['Renamed breakfast', JSON.stringify([{ ...presetItem, quantity: 1, foodSnapshot: { ...presetItem.foodSnapshot, gi: 80 } }]), '2000-01-01T00:00:00Z', ids.preset]);
  const updatedPreset = (await rows('select * from public.glucose_meal_presets where id=$1', [ids.preset]))[0];
  assert(new Date(updatedPreset.created_at).getTime() === new Date(savedPreset.created_at).getTime() && new Date(updatedPreset.updated_at).getTime() >= new Date(savedPreset.updated_at).getTime(), 'preset updates preserve creation time and refresh updated time');
  assert((await rows('select items from public.glucose_meals where id=$1', [appliedMeal.id]))[0].items[0].foodSnapshot.gi === 50, 'editing a preset does not alter an existing meal food snapshot');
  const disposablePreset = (await rows('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4) returning id', [ids.pa2, 'Other member combination', 'lunch', presetItems]))[0];
  assert((await rows('select profile_id from public.glucose_meal_presets where id=$1', [disposablePreset.id]))[0].profile_id === ids.pa2, 'one account can keep a separate combination for another member');
  await db.query('delete from public.glucose_meal_presets where id=$1', [disposablePreset.id]);
  assert((await rows('select * from public.glucose_meal_presets where id=$1', [disposablePreset.id])).length === 0, 'owner can delete a saved combination');
  assert((await rows('select items from public.glucose_meals where id=$1', [appliedMeal.id]))[0].items[0].quantity === 2, 'deleting a saved combination leaves dated meals and quantities intact');
  await as('postgres');
  await db.exec(presetMigration);
  await as('authenticated', ids.a);
  assert((await rows('select name from public.glucose_meal_presets where id=$1', [ids.preset]))[0].name === 'Renamed breakfast', 'rerunning the migration preserves existing combinations');
  await denied('update public.glucose_meal_presets set profile_id=$1 where id=$2', [ids.pa2, ids.preset], 'preset cannot be moved to another member of same account');
  await denied('update public.glucose_meal_presets set user_id=$1,profile_id=$2 where id=$3', [ids.b, ids.pb, ids.preset], 'preset ownership cannot be transferred');
  await denied('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pb, 'Wrong owner member', 'breakfast', presetItems], 'preset composite foreign key rejects foreign account member');
  for (const badName of ['', '  ', 'x'.repeat(61)]) await denied('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pa, badName, 'breakfast', presetItems], 'invalid preset name rejected');
  for (const invalidItems of [[], Array.from({ length: 101 }, (_, index) => ({ ...presetItem, id: `item-${index}` })), [{ ...presetItem, quantity: 0 }], [{ ...presetItem, quantity: -1 }], [{ ...presetItem, quantity: '1' }], [{ ...presetItem, quantity: 'NaN' }], [{ ...presetItem, name: '  ' }], [{ ...presetItem, name: 'x'.repeat(201) }], [{ ...presetItem, unit: '' }], [{ ...presetItem, grams: -1 }], [{ ...presetItem, grams: '100' }], [{ ...presetItem, foodId: '' }], [presetItem, presetItem], [{ ...presetItem, foodSnapshot: null }], [{ ...presetItem, foodSnapshot: { ...presetItem.foodSnapshot, giStatus: 'unknown' } }], [{ ...presetItem, foodSnapshot: { ...presetItem.foodSnapshot, gi: null } }], [{ ...presetItem, foodSnapshot: { ...presetItem.foodSnapshot, availableCarbsPer100g: 101 } }]]) {
    await denied('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pa, 'Invalid food snapshot', 'breakfast', JSON.stringify(invalidItems)], 'invalid preset food/portion data rejected');
  }
  await denied('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pa, 'Bad meal type', 'brunch', presetItems], 'preset meal type validated');
  await as('authenticated', ids.b);
  assert((await rows('select * from public.glucose_meal_presets where id=$1', [ids.preset])).length === 0, 'B cannot read A saved combinations');
  assert((await rows('update public.glucose_meal_presets set name=$1 where id=$2 returning id', ['Tampered preset', ids.preset])).length === 0, 'B cannot update A saved combination');
  assert((await rows('delete from public.glucose_meal_presets where id=$1 returning id', [ids.preset])).length === 0, 'B cannot delete A saved combination');
  await denied('insert into public.glucose_meal_presets(user_id,profile_id,name,meal_type,items) values ($1,$2,$3,$4,$5)', [ids.a, ids.pa, 'Forged preset', 'breakfast', presetItems], 'B cannot forge A preset ownership');
  await as('authenticated', ids.unadmitted);
  assert((await rows('select * from public.glucose_meal_presets')).length === 0, 'unadmitted user cannot read presets');
  await denied('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pa, 'Unadmitted preset', 'breakfast', presetItems], 'unadmitted user cannot save presets');
  await as('service_role');
  await db.query('update public.glucose_accounts set status=$1 where user_id=$2', ['suspended', ids.a]);
  await as('authenticated', ids.a);
  assert((await rows('select * from public.glucose_profiles')).length === 0, 'suspended account cannot read private data');
  assert((await rows('select status from public.glucose_accounts'))[0].status === 'suspended', 'suspended account can read own access state');
  await denied('insert into public.glucose_profiles(name) values ($1)', ['Suspended'], 'suspended account cannot write');
  assert((await rows('select * from public.glucose_meal_presets')).length === 0, 'suspended account cannot read presets');
  assert((await rows('delete from public.glucose_meal_presets where id=$1 returning id', [ids.preset])).length === 0, 'suspended account cannot delete preset');
  await denied('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pa, 'Suspended preset', 'breakfast', presetItems], 'suspended account cannot save presets');
  await as('service_role');
  await db.query('update public.glucose_accounts set status=$1 where user_id=$2', ['active', ids.a]);
  await as('authenticated', ids.a);
  const cascadeMeal = (await rows('insert into public.glucose_meals(profile_id,meal_type,started_at) values ($1,$2,$3) returning id', [ids.pa, 'dinner', '2026-10-19T10:00:00Z']))[0];
  await db.query('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,6,$2,$3,$4)', [ids.pa, 'after-meal', cascadeMeal.id, '2026-10-19T12:00:00Z']);
  await db.query('delete from public.glucose_profiles where id=$1', [ids.pa]);
  assert((await rows('select * from public.glucose_meals where profile_id=$1', [ids.pa])).length === 0, 'profile deletion cascades meals with linked readings');
  assert((await rows('select * from public.glucose_readings where profile_id=$1', [ids.pa])).length === 0, 'profile deletion cascades readings');
  assert((await rows('select * from public.glucose_favorites where profile_id=$1', [ids.pa])).length === 0, 'profile deletion cascades favorites');
  assert((await rows('select * from public.glucose_meal_presets where profile_id=$1', [ids.pa])).length === 0, 'profile deletion cascades saved combinations');
  await as('authenticated', ids.b);
  assert((await rows('select * from public.glucose_profiles where id=$1', [ids.pb])).length === 1, 'other account data remains intact');
  await as('authenticated', ids.a);
  const authCascadeMeal = (await rows('insert into public.glucose_meals(profile_id,meal_type,started_at) values ($1,$2,$3) returning id', [ids.pa2, 'dinner', '2026-10-19T10:00:00Z']))[0];
  await db.query('insert into public.glucose_readings(profile_id,value,context,meal_id,measured_at) values ($1,6,$2,$3,$4)', [ids.pa2, 'after-meal', authCascadeMeal.id, '2026-10-19T12:00:00Z']);
  await db.query('insert into public.glucose_meal_presets(profile_id,name,meal_type,items) values ($1,$2,$3,$4)', [ids.pa2, 'Auth cascade preset', 'dinner', presetItems]);
  await as('postgres');
  await db.query('delete from auth.users where id=$1', [ids.a]);
  assert((await rows('select * from public.glucose_profiles where user_id=$1', [ids.a])).length === 0, 'Auth deletion cascades profile');
  assert((await rows('select * from public.glucose_accounts where user_id=$1', [ids.a])).length === 0, 'Auth deletion cascades account admission');
  assert((await rows('select * from public.glucose_meals where user_id=$1', [ids.a])).length === 0, 'Auth deletion cascades active meals');
  assert((await rows('select * from public.glucose_readings where user_id=$1', [ids.a])).length === 0, 'Auth deletion cascades linked measurements');
  assert((await rows('select * from public.glucose_meal_presets where user_id=$1', [ids.a])).length === 0, 'Auth deletion cascades saved combinations');
  console.log(`Passed ${assertions} PostgreSQL migration/RLS assertions without any cloud connection.`);
} catch (error) {
  console.error(`Local database test failed after ${assertions} assertions: ${error.code || 'assertion'} ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
