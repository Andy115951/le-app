#!/usr/bin/env node
// Integration test against the selected Supabase project. Creates only temporary
// synthetic users and removes those exact IDs in finally; never uses real data.
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';

import { cloudTestConfig } from './lib/cloud-target.mjs';

let config;
try { config = cloudTestConfig(); } catch (error) { console.error(error.message); process.exit(1); }
const { url, anonKey, adminKey } = config;

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, adminKey, options);
const created = [];
let assertions = 0;
function assert(condition, label) {
  if (!condition) throw new Error(`Failed: ${label}`);
  assertions += 1;
}
async function ok(request, label) {
  const result = await request;
  assert(!result.error, `${label}${result.error?.code ? ` (code ${result.error.code})` : ''}`);
  return result.data;
}
async function denied(request, label) {
  const result = await request;
  assert(Boolean(result.error) || (Array.isArray(result.data) && result.data.length === 0), label);
}
async function syntheticUser() {
  const email = `glucose-rls-${randomUUID()}@example.com`;
  const password = `Glucose-Test-${randomBytes(20).toString('hex')}`;
  const response = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!response.error && Boolean(response.data.user?.id), 'create synthetic Auth user');
  const id = response.data.user.id;
  created.push(id);
  const client = createClient(url, anonKey, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert(!signedIn.error && signedIn.data.user?.id === id, 'authenticate synthetic user');
  return { id, client };
}

try {
  const a = await syntheticUser();
  const b = await syntheticUser();
  const outsider = await syntheticUser();
  const anon = createClient(url, anonKey, options);
  await ok(admin.from('glucose_accounts').insert([{ user_id: a.id }, { user_id: b.id }]), 'admit two synthetic users');
  await denied(anon.from('glucose_profiles').select('*'), 'anonymous cannot read private profiles');
  await denied(anon.from('glucose_profiles').insert({ name: 'Anon' }).select(), 'anonymous cannot write private profiles');
  await denied(outsider.client.from('glucose_profiles').insert({ name: 'Unadmitted' }).select(), 'unadmitted Auth user cannot write private data');
  await denied(outsider.client.from('glucose_accounts').insert({ user_id: outsider.id }).select(), 'Auth user cannot self-enroll');
  const ownAccounts = await ok(a.client.from('glucose_accounts').select('*'), 'read own access state');
  assert(ownAccounts.length === 1 && ownAccounts[0].user_id === a.id, 'account state is isolated');

  const [pa] = await ok(a.client.from('glucose_profiles').insert({ name: 'Test A', timezone: 'Asia/Shanghai' }).select(), 'create own profile');
  const [pa2] = await ok(a.client.from('glucose_profiles').insert({ name: 'Test A family' }).select(), 'create second member');
  const [pb] = await ok(b.client.from('glucose_profiles').insert({ name: 'Test B' }).select(), 'create B profile');
  await denied(a.client.from('glucose_profiles').insert({ name: 'Forged owner', user_id: b.id }).select(), 'profile owner cannot be forged');
  await denied(a.client.from('glucose_profiles').insert({ name: 'Wrong timezone', timezone: 'Made/Up' }).select(), 'unknown timezone rejected');
  await denied(b.client.from('glucose_profiles').select('*').eq('id', pa.id), 'B cannot read A profile by ID');
  await denied(b.client.from('glucose_profiles').update({ name: 'Tampered' }).eq('id', pa.id).select(), 'B cannot update A profile');
  await denied(b.client.from('glucose_profiles').delete().eq('id', pa.id).select(), 'B cannot delete A profile');

  const mealInput = { profile_id: pa.id, meal_type: 'lunch', started_at: '2026-10-19T04:00:00Z', items: [{ id: randomUUID(), name: 'Synthetic rice', foodId: null, quantity: 1, unit: '碗', grams: null }] };
  const [meal] = await ok(a.client.from('glucose_meals').insert(mealInput).select(), 'create meal with atomic items');
  await denied(a.client.from('glucose_meals').insert({ ...mealInput, profile_id: pb.id }).select(), 'meal cannot use another user profile');
  await denied(a.client.from('glucose_meals').insert({ ...mealInput, items: [{ name: '' }] }).select(), 'malformed meal items rejected');
  const readingInput = { profile_id: pa.id, value: 108, unit: 'mg/dL', context: 'after-meal', meal_id: meal.id, measured_at: '2026-10-19T06:00:00Z', post_meal_minutes: 1, timing_source: 'manual' };
  const [reading] = await ok(a.client.from('glucose_readings').insert(readingInput).select(), 'create linked measurement');
  assert(Number(reading.value_mmol) === 6, 'canonical value generated from raw unit');
  assert(reading.post_meal_minutes === 120 && reading.timing_source === 'calculated', 'linked interval calculated from actual times');
  await denied(a.client.from('glucose_readings').update({ value_mmol: 99 }).eq('id', reading.id).select(), 'canonical value cannot be forged');
  await denied(a.client.from('glucose_readings').insert({ ...readingInput, profile_id: pa2.id }).select(), 'same-account cross-member meal link rejected');
  await denied(b.client.from('glucose_readings').insert({ ...readingInput, profile_id: pb.id }).select(), 'cross-user meal link rejected');
  await denied(a.client.from('glucose_readings').insert({ ...readingInput, measured_at: '2026-10-19T03:59:00Z' }).select(), 'after-meal measurement before meal rejected');
  await denied(b.client.from('glucose_readings').select('*').eq('id', reading.id), 'B cannot read A measurement');
  await denied(b.client.from('glucose_meals').delete().eq('id', meal.id).select(), 'B cannot delete A meal');
  await denied(a.client.from('glucose_readings').update({ user_id: b.id, profile_id: pb.id }).eq('id', reading.id).select(), 'measurement owner cannot be changed');

  await ok(a.client.from('glucose_meals').update({ started_at: '2026-10-19T04:30:00Z' }).eq('id', meal.id).select(), 'edit meal start');
  const updated = await ok(a.client.from('glucose_readings').select('*').eq('id', reading.id).single(), 'reload linked measurement');
  assert(updated.post_meal_minutes === 90, 'meal time edit updates linked intervals');
  await denied(a.client.from('glucose_meals').update({ started_at: '2026-10-19T06:01:00Z' }).eq('id', meal.id).select(), 'conflicting meal time edit rejected atomically');
  const [manual] = await ok(a.client.from('glucose_readings').insert({ profile_id: pa.id, value: 7.1, unit: 'mmol/L', context: 'after-meal', measured_at: '2026-10-19T08:00:00Z', post_meal_minutes: 85, timing_source: 'calculated' }).select(), 'manual after-meal interval');
  assert(manual.timing_source === 'manual' && manual.post_meal_minutes === 85, 'unlinked interval cannot falsely claim calculated source');
  const [special] = await ok(a.client.from('glucose_readings').insert({ profile_id: pa.id, value: null, special: 'HI', context: 'random', measured_at: '2026-10-19T09:00:00Z' }).select(), 'HI reading without invented value');
  assert(special.value_mmol === null && special.value === null, 'special reading remains nonnumeric');
  await denied(a.client.from('glucose_readings').insert({ profile_id: pa.id, value: 3, special: 'LO', context: 'random', measured_at: '2026-10-19T09:00:00Z' }).select(), 'numeric and HI/LO are mutually exclusive');

  const favorite = { profile_id: pa.id, kind: 'food', reference_id: 'synthetic-food' };
  await ok(a.client.from('glucose_favorites').insert(favorite), 'create member favorite');
  await denied(a.client.from('glucose_favorites').insert(favorite).select(), 'favorites are unique per member');
  await denied(a.client.from('glucose_favorites').insert({ ...favorite, profile_id: pb.id }).select(), 'favorite cannot target another account');
  await denied(b.client.from('glucose_favorites').select('*').eq('profile_id', pa.id), 'favorites are private');
  await ok(a.client.from('glucose_meals').delete().eq('id', meal.id).select(), 'delete linked meal');
  const unlinked = await ok(a.client.from('glucose_readings').select('*').eq('id', reading.id).single(), 'measurement survives meal deletion');
  assert(unlinked.meal_id === null && unlinked.post_meal_minutes === 90 && unlinked.timing_source === 'calculated', 'meal deletion preserves measurement and interval provenance');

  await ok(admin.from('glucose_accounts').update({ status: 'suspended' }).eq('user_id', a.id), 'suspend synthetic account');
  await denied(a.client.from('glucose_profiles').select('*'), 'suspended user cannot read private records');
  await denied(a.client.from('glucose_profiles').insert({ name: 'Suspended write' }).select(), 'suspended user cannot write private records');
  await ok(admin.from('glucose_accounts').update({ status: 'active' }).eq('user_id', a.id), 'restore synthetic account');
  await ok(a.client.from('glucose_profiles').delete().eq('id', pa.id).select(), 'delete member profile');
  const remainingReadings = await ok(a.client.from('glucose_readings').select('*').eq('profile_id', pa.id), 'read deleted member records');
  assert(remainingReadings.length === 0, 'member deletion cascades measurements');
  const remainingFavorites = await ok(a.client.from('glucose_favorites').select('*').eq('profile_id', pa.id), 'read deleted member favorites');
  assert(remainingFavorites.length === 0, 'member deletion cascades favorites');
  const intactB = await ok(b.client.from('glucose_profiles').select('*').eq('id', pb.id), 'B data remains after A member deletion');
  assert(intactB.length === 1, 'B profile was never modified');
  console.log(`Passed ${assertions} database assertions: anonymous/access isolation, ownership, member links, measured intervals, special values, and deletion.`);
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Failed: ') ? error.message : 'Database integration test failed without displaying private error details.');
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  for (const id of created.reverse()) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) cleanupFailed = true;
  }
  if (cleanupFailed) {
    console.error('A synthetic user could not be removed. Remove only the glucose-rls- test users created by this run in Supabase Auth.');
    process.exitCode = 1;
  } else if (created.length) {
    console.log('All synthetic Auth users and their private records were removed.');
  }
}
