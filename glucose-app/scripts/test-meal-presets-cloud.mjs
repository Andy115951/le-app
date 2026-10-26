#!/usr/bin/env node
// Explicit integration check for the additive meal-preset migration. Uses only
// random synthetic accounts and removes those exact accounts in finally.
// Run after applying 202610200001_glucose_meal_presets.sql:
// GLUCOSE_RUN_CLOUD_TESTS=1 node --env-file=.env.local scripts/test-meal-presets-cloud.mjs
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

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
  assert(result.error
    ? ['42501', '23503', '23514', '23505', '22P02'].includes(result.error.code)
    : Array.isArray(result.data) && result.data.length === 0, label);
}
async function syntheticUser() {
  const email = `glucose-presets-test-${randomUUID()}@example.com`;
  const password = `Glucose-Test-${randomBytes(20).toString('hex')}`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.data.user?.id) created.push(result.data.user.id);
  assert(!result.error && Boolean(result.data.user?.id), 'create synthetic Auth user');
  const id = result.data.user.id;
  const client = createClient(url, anonKey, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert(!signedIn.error && signedIn.data.user?.id === id, 'authenticate synthetic user');
  return { id, client };
}

try {
  // Empty metadata probe before creating any user. Never scans real records.
  await ok(admin.from('glucose_meal_presets').select('id').limit(0), 'meal-preset migration is available');
  const a = await syntheticUser();
  const b = await syntheticUser();
  const outsider = await syntheticUser();
  const anon = createClient(url, anonKey, options);
  await ok(admin.from('glucose_accounts').insert([{ user_id: a.id }, { user_id: b.id }]), 'admit two synthetic accounts');
  const [pa, pa2] = await ok(a.client.from('glucose_profiles').insert([{ name: 'Preset test A' }, { name: 'Preset test A family' }]).select(), 'create two A members');
  const [pb] = await ok(b.client.from('glucose_profiles').insert({ name: 'Preset test B' }).select(), 'create B member');
  const items = [{
    id: randomUUID(), foodId: 'rice-white', name: 'Synthetic rice', quantity: 0.5,
    unit: '碗', grams: 60,
    foodSnapshot: { gi: 45, giStatus: 'known', availableCarbsPer100g: 20 },
  }];
  const input = { profile_id: pa.id, name: 'Synthetic breakfast', meal_type: 'breakfast', items };

  await denied(anon.from('glucose_meal_presets').select('id'), 'anonymous cannot read presets');
  await denied(anon.from('glucose_meal_presets').insert(input).select('id'), 'anonymous cannot create presets');
  await denied(outsider.client.from('glucose_meal_presets').select('id'), 'unadmitted user cannot read presets');
  await denied(outsider.client.from('glucose_meal_presets').insert(input).select('id'), 'unadmitted user cannot create presets');
  const [preset] = await ok(a.client.from('glucose_meal_presets').insert(input).select(), 'create own member preset');
  assert(preset.user_id === a.id && preset.profile_id === pa.id, 'preset owner defaults to JWT identity');
  assert(isDeepStrictEqual(preset.items, items), 'preset retains food snapshot and amount');
  await denied(a.client.from('glucose_meal_presets').insert({ ...input, user_id: b.id }).select('id'), 'cannot forge preset owner');
  await denied(a.client.from('glucose_meal_presets').insert({ ...input, profile_id: pb.id }).select('id'), 'cannot use foreign member');
  await denied(b.client.from('glucose_meal_presets').select('id').eq('id', preset.id), 'B cannot read A preset by ID');
  await denied(b.client.from('glucose_meal_presets').update({ name: 'Tampered' }).eq('id', preset.id).select('id'), 'B cannot update A preset');
  await denied(b.client.from('glucose_meal_presets').delete().eq('id', preset.id).select('id'), 'B cannot delete A preset');
  const aFamilyPresets = await ok(a.client.from('glucose_meal_presets').select('id').eq('profile_id', pa2.id), 'read second member presets');
  assert(aFamilyPresets.length === 0, 'presets are scoped to their selected member');
  await denied(a.client.from('glucose_meal_presets').update({ profile_id: pa2.id }).eq('id', preset.id).select('id'), 'preset cannot be moved to another member');
  await denied(a.client.from('glucose_meal_presets').update({ user_id: b.id, profile_id: pb.id }).eq('id', preset.id).select('id'), 'preset ownership cannot be transferred');

  const invalidCases = [
    [{ name: ' ' }, 'blank preset name rejected'],
    [{ name: 'x'.repeat(61) }, 'overlong preset name rejected'],
    [{ meal_type: 'unknown' }, 'invalid meal type rejected'],
    [{ items: [] }, 'empty combination rejected'],
    [{ items: Array.from({ length: 101 }, (_, i) => ({ ...items[0], id: `item-${i}` })) }, 'more than 100 ingredients rejected'],
    [{ items: [{ ...items[0], name: '' }] }, 'blank ingredient name rejected'],
    [{ items: [{ ...items[0], id: '' }] }, 'blank ingredient ID rejected'],
    [{ items: [items[0], items[0]] }, 'duplicate ingredient IDs rejected'],
    [{ items: [{ ...items[0], quantity: 0 }] }, 'zero quantity rejected'],
    [{ items: [{ ...items[0], quantity: -1 }] }, 'negative quantity rejected'],
    [{ items: [{ ...items[0], quantity: '1' }] }, 'string quantity rejected'],
    [{ items: [{ ...items[0], unit: '' }] }, 'blank quantity unit rejected'],
    [{ items: [{ ...items[0], grams: 0 }] }, 'zero weight rejected'],
    [{ items: [{ ...items[0], foodId: '' }] }, 'blank food ID rejected'],
    [{ items: [{ ...items[0], foodSnapshot: { giStatus: 'known', gi: null, availableCarbsPer100g: 20 } }] }, 'known GI without value rejected'],
    [{ items: [{ ...items[0], foodSnapshot: { giStatus: 'unknown', gi: 45, availableCarbsPer100g: null } }] }, 'unknown GI with invented value rejected'],
    [{ items: [{ ...items[0], foodSnapshot: { giStatus: 'known', gi: 45, availableCarbsPer100g: 101 } }] }, 'carbohydrate proportion above 100 rejected'],
  ];
  for (const [changes, label] of invalidCases) {
    await denied(a.client.from('glucose_meal_presets').insert({ ...input, ...changes }).select('id'), label);
  }
  const updated = await ok(a.client.from('glucose_meal_presets').update({ name: 'Updated synthetic breakfast', created_at: '2099-01-01T00:00:00Z' }).eq('id', preset.id).select().single(), 'rename own preset');
  assert(updated.name === 'Updated synthetic breakfast', 'own preset rename persisted');
  assert(updated.created_at === preset.created_at, 'preset creation timestamp is immutable');

  const mealInput = { profile_id: pa.id, meal_type: 'breakfast', started_at: '2026-10-20T00:00:00Z', items };
  const [sourceMeal] = await ok(a.client.from('glucose_meals').insert(mealInput).select(), 'create synthetic source meal');
  const changedSource = await ok(a.client.from('glucose_meals').update({ items: [{ ...items[0], quantity: 2, name: 'Changed source meal' }] }).eq('id', sourceMeal.id).select('items').single(), 'edit source meal after saving combination');
  assert(changedSource.items[0].quantity === 2, 'source meal edit actually persisted');
  let saved = await ok(a.client.from('glucose_meal_presets').select('*').eq('id', preset.id).single(), 'reload independent preset snapshot');
  assert(saved.items[0].quantity === 0.5 && saved.items[0].name === 'Synthetic rice', 'editing source meal does not change saved combination');
  await ok(a.client.from('glucose_meals').delete().eq('id', sourceMeal.id).select('id').single(), 'delete synthetic source meal');
  saved = await ok(a.client.from('glucose_meal_presets').select('*').eq('id', preset.id).single(), 'combination survives source meal deletion');
  const [appliedMeal] = await ok(a.client.from('glucose_meals').insert({ ...mealInput, items: saved.items.map(item => ({ ...item, id: randomUUID() })) }).select(), 'apply saved combination to new meal snapshot');
  const changedPreset = await ok(a.client.from('glucose_meal_presets').update({ items: [{ ...items[0], quantity: 3, grams: 360 }] }).eq('id', preset.id).select('items').single(), 'edit saved combination amount');
  assert(changedPreset.items[0].quantity === 3 && changedPreset.items[0].grams === 360, 'saved combination edit actually persisted');
  let applied = await ok(a.client.from('glucose_meals').select('*').eq('id', appliedMeal.id).single(), 'reload applied meal');
  assert(applied.items[0].quantity === 0.5 && applied.items[0].grams === 60 && applied.items[0].foodSnapshot.gi === 45, 'editing combination leaves historical meal and food snapshot intact');
  await ok(a.client.from('glucose_meal_presets').delete().eq('id', preset.id).select('id').single(), 'delete own saved combination');
  applied = await ok(a.client.from('glucose_meals').select('*').eq('id', appliedMeal.id).single(), 'meal survives combination deletion');
  assert(applied.items[0].quantity === 0.5, 'deleting combination leaves recorded amount intact');

  const [cascadePreset] = await ok(a.client.from('glucose_meal_presets').insert(input).select(), 'create preset for member deletion test');
  const [bPreset] = await ok(b.client.from('glucose_meal_presets').insert({ ...input, profile_id: pb.id }).select(), 'create independent B preset');
  await ok(admin.from('glucose_accounts').update({ status: 'suspended' }).eq('user_id', a.id), 'suspend only synthetic A account');
  await denied(a.client.from('glucose_meal_presets').select('id'), 'suspended account cannot read presets');
  await denied(a.client.from('glucose_meal_presets').insert(input).select('id'), 'suspended account cannot create presets');
  await denied(a.client.from('glucose_meal_presets').update({ name: 'Suspended change' }).eq('id', cascadePreset.id).select('id'), 'suspended account cannot update presets');
  await denied(a.client.from('glucose_meal_presets').delete().eq('id', cascadePreset.id).select('id'), 'suspended account cannot delete presets');
  await ok(admin.from('glucose_accounts').update({ status: 'active' }).eq('user_id', a.id), 'restore synthetic A account');
  await ok(a.client.from('glucose_profiles').delete().eq('id', pa.id).select('id').single(), 'delete synthetic A member');
  const afterMemberDeletion = await ok(admin.from('glucose_meal_presets').select('id').eq('id', cascadePreset.id), 'check preset cascade by exact synthetic ID');
  assert(afterMemberDeletion.length === 0, 'member deletion cascades own presets');
  const intactB = await ok(b.client.from('glucose_meal_presets').select('id').eq('id', bPreset.id), 'read unchanged B preset');
  assert(intactB.length === 1, 'another account preset remains intact');
  const [authCascadePreset] = await ok(a.client.from('glucose_meal_presets').insert({ ...input, profile_id: pa2.id }).select(), 'create preset for Auth deletion test');
  await ok(admin.auth.admin.deleteUser(a.id), 'delete exact synthetic A Auth user');
  created.splice(created.indexOf(a.id), 1);
  const afterAuthDeletion = await ok(admin.from('glucose_meal_presets').select('id').eq('id', authCascadePreset.id), 'check Auth cascade by exact synthetic ID');
  assert(afterAuthDeletion.length === 0, 'Auth deletion cascades own presets');
  console.log(`Passed ${assertions} meal-preset cloud assertions: access isolation, member ownership, input validation, independent snapshots, suspension, and deletion.`);
} catch (error) {
  // Database and Auth error bodies can contain private values; only our fixed labels are displayed.
  console.error(error instanceof Error && error.message.startsWith('Failed: ') ? error.message : 'Meal-preset cloud check failed without displaying private error details.');
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  for (const id of created.reverse()) {
    try {
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) cleanupFailed = true;
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) {
    console.error('A synthetic user could not be removed. Inspect only glucose-presets-test- users from this run in Supabase Auth.');
    process.exitCode = 1;
  } else if (created.length) {
    console.log('All remaining synthetic Auth users and their private records were removed.');
  }
}
