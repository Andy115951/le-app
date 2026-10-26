import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealItem } from "./domain";
import { cloneMealItems, validateMealPreset, type MealPreset } from "./meal-presets";
import { mealPresetFromRow, mealPresetToRow, readProfileRecords } from "./cloud";

const items: MealItem[] = [{ id: "original-item", foodId: "rice-white", name: "白米饭", quantity: 0.5, unit: "碗", grams: 115,
  foodSnapshot: { gi: 83, giStatus: "known", availableCarbsPer100g: 21.74 } }];
const preset: MealPreset = { id: "preset-a", profileId: "profile-a", name: "我的早餐", mealType: "breakfast", items };

test("saved combinations and every applied meal keep independent item IDs and food snapshots", () => {
  const saved = cloneMealItems(items);
  const firstMeal = cloneMealItems(saved);
  const secondMeal = cloneMealItems(saved);
  assert.equal(new Set([items[0].id, saved[0].id, firstMeal[0].id, secondMeal[0].id]).size, 4);
  firstMeal[0].name = "午餐换成糙米饭";
  firstMeal[0].quantity = 1;
  firstMeal[0].foodSnapshot!.gi = 50;
  assert.equal(saved[0].name, "白米饭");
  assert.equal(saved[0].quantity, 0.5);
  assert.equal(saved[0].foodSnapshot!.gi, 83);
  assert.equal(items[0].foodSnapshot!.gi, 83);
  assert.equal(secondMeal[0].foodSnapshot!.gi, 83);
});

test("combinations validate full food/portion data without inventing nutrition for custom foods", () => {
  validateMealPreset(preset);
  validateMealPreset({ ...preset, name: ` ${"早".repeat(60)} `, items: [{ ...items[0], foodId: null, grams: null, foodSnapshot: undefined }] });
  for (const name of ["", "  ", "早".repeat(61)]) assert.throws(() => validateMealPreset({ ...preset, name }), /名称/);
  for (const quantity of [0, -1, NaN, Infinity, "1"]) assert.throws(() => validateMealPreset({ ...preset, items: [{ ...items[0], quantity } as MealItem] }), /份量/);
  for (const invalid of [[], Array.from({ length: 101 }, () => items[0])]) assert.throws(() => validateMealPreset({ ...preset, items: invalid }), /1–100/);
  for (const update of [{ name: " " }, { name: "a".repeat(201) }, { unit: " " }, { grams: -1 }, { foodId: "" }, { grams: undefined }])
    assert.throws(() => validateMealPreset({ ...preset, items: [{ ...items[0], ...update } as MealItem] }));
  assert.throws(() => validateMealPreset({ ...preset, mealType: "brunch" as MealPreset["mealType"] }), /餐次/);
  assert.throws(() => validateMealPreset({ ...preset, items: [items[0], items[0]] }), /食物已变化/);
  assert.throws(() => validateMealPreset({ ...preset, items: [{ ...items[0], foodSnapshot: { giStatus: "unknown", gi: 0, availableCarbsPer100g: null } }] }), /快照/);
  assert.throws(() => validateMealPreset({ ...preset, items: [{ ...items[0], foodSnapshot: { giStatus: "known", gi: null, availableCarbsPer100g: null } }] }), /快照/);
  assert.throws(() => validateMealPreset({ ...preset, items: [{ ...items[0], foodSnapshot: { giStatus: "known", gi: 45, availableCarbsPer100g: 101 } }] }), /快照/);
});

test("cloud mapping trims the name and isolates stored snapshots from the form", () => {
  const input = { ...preset, name: "  常吃早餐  ", items: cloneMealItems(items) };
  const row = mealPresetToRow(input, "owner-a");
  assert.equal(row.name, "常吃早餐");
  assert.equal(row.user_id, "owner-a");
  assert.equal(row.profile_id, "profile-a");
  const restored = mealPresetFromRow({ ...row, created_at: "2026-10-20T00:00Z", updated_at: "2026-10-20T00:01Z" });
  input.items[0].quantity = 8;
  restored.items[0].foodSnapshot!.gi = 1;
  assert.equal(row.items[0].quantity, 0.5);
  assert.equal(row.items[0].foodSnapshot!.gi, 83);
  assert.equal(restored.createdAt, "2026-10-20T00:00Z");
});

test("member record loading paginates combinations with stable creation-date/ID order and ownership filters", async () => {
  const calls: { table: string; filters: string[][]; order: string[]; range?: number[] }[] = [];
  const client = { from(table: string) {
    const call: typeof calls[number] = { table, filters: [], order: [] };
    calls.push(call);
    const query = {
      select() { return query; },
      eq(key: string, value: string) { call.filters.push([key, value]); return query; },
      order(key: string) { call.order.push(key); return query; },
      range(from: number, to: number) {
        call.range = [from, to];
        const count = table === "glucose_meal_presets" ? Math.min(500, Math.max(0, 501 - from)) : 0;
        return Promise.resolve({ data: Array.from({ length: count }, (_, index) => ({ id: `preset-${from + index}`, profile_id: "profile-a", name: "早餐", meal_type: "breakfast", items })), error: null });
      },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
    return query;
  } } as unknown as SupabaseClient;
  const result = await readProfileRecords(client, "owner-a", "profile-a");
  assert.equal(result.mealPresets.length, 501);
  assert.equal(result.mealPresets[500].id, "preset-500");
  assert.deepEqual(calls.filter(call => call.table === "glucose_meal_presets").map(call => call.range), [[0, 499], [500, 999]]);
  for (const call of calls) {
    assert.deepEqual(call.filters, [["user_id", "owner-a"], ["profile_id", "profile-a"]]);
    if (call.table === "glucose_meal_presets") assert.deepEqual(call.order, ["created_at", "id"]);
  }
});
