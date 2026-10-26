import assert from "node:assert/strict";
import test from "node:test";
import type { Meal, Reading } from "./domain";
import { readingsForMeal, timingFromMeal } from "./meal-review";

const meal: Meal = { id: "meal", profileId: "me", type: "dinner", startedAt: "2026-10-20T15:30:00Z", notes: "", templateId: null, items: [] };
const reading: Reading = { id: "after", profileId: "me", mealId: "meal", measuredAt: "2026-10-20T17:30:00Z", context: "after-meal", value: null, unit: "mg/dL", special: "HI", standardValue: null, postMealMinutes: 120, intervalSource: "calculated", notes: "跨日实测" };

test("meal review includes explicitly linked cross-midnight readings, excludes other members and unlinked nearby measurements", () => {
  const before: Reading = { ...reading, id: "before", context: "before-meal", measuredAt: "2026-10-20T15:10:00Z" };
  const all = [reading, { ...reading, id: "other-member", profileId: "family" }, { ...reading, id: "nearby", mealId: null }, { ...reading, id: "other-meal", mealId: "lunch" }, before];
  const original = structuredClone(all);
  const result = readingsForMeal(meal, all);
  assert.deepEqual(result.map(item => item.id), ["before", "after"]);
  assert.deepEqual(result[1], reading); // HI and original unit/notes remain intact.
  assert.deepEqual(all, original);
  assert.deepEqual(readingsForMeal({ ...meal, id: "empty" }, all), []);
});

test("meal review calculates signed intervals from actual instants even when stored minutes differ", () => {
  assert.equal(timingFromMeal(meal, { ...reading, postMealMinutes: 30 }), "用餐后 120 分钟");
  assert.equal(timingFromMeal(meal, { ...reading, measuredAt: "2026-10-20T15:10:00Z" }), "用餐前 20 分钟");
  assert.equal(timingFromMeal(meal, { ...reading, measuredAt: meal.startedAt }), "用餐开始时");
  assert.equal(timingFromMeal(meal, { ...reading, measuredAt: "invalid" }), "请核对记录时间");
});
