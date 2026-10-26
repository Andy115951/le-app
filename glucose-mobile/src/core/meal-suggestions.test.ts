import assert from "node:assert/strict";
import test from "node:test";
import { MEAL_TEMPLATES } from "../data/meal-templates";
import { filterTemplates, type MealTemplate, type Profile } from "./domain";
import { mealSuggestions, templateMealItems } from "./meal-suggestions";

const profile: Profile = { id: "me", name: "本人", timezone: "Asia/Shanghai", unit: "mmol/L", allergies: [], avoidances: [], preferences: ["快手"], maxCookingMinutes: null, targets: {} };
test("single-meal swaps include every eligible meal, prefer matching tastes first and never relax restrictions", () => {
  const restricted = { ...profile, allergies: ["牛奶", "小麦"], avoidances: ["香菇"], maxCookingMinutes: 20 };
  for (const type of ["breakfast", "lunch", "dinner"] as const) {
    const pool = mealSuggestions(MEAL_TEMPLATES, restricted, "2026-10-22", type);
    assert.deepEqual(new Set(pool.map(item => item.id)), new Set(filterTemplates(MEAL_TEMPLATES, restricted, type).map(item => item.id)));
    assert.equal(new Set(pool.map(item => item.id)).size, pool.length);
    assert.deepEqual(pool, mealSuggestions(MEAL_TEMPLATES, restricted, "2026-10-22", type));
    const scores = pool.map(item => restricted.preferences.filter(tag => item.tags.includes(tag)).length);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  }
  assert.equal(mealSuggestions(MEAL_TEMPLATES, { ...profile, maxCookingMinutes: 1 }, "2026-10-22", "lunch").length, 0);
  const vegan = mealSuggestions(MEAL_TEMPLATES, { ...profile, preferences: ["纯素"] }, "2026-10-22", "breakfast");
  assert(vegan.length > 0 && vegan.every(item => item.tags.includes("纯素")));
});

test("template drafts preserve dry/raw weights, condiments and annotations without invented GI or volume-to-weight conversion", () => {
  const oats = templateMealItems(MEAL_TEMPLATES.find(item => item.id === "breakfast-oats")!);
  assert.equal(oats[0].quantity, 35); assert.equal(oats[0].unit, "克"); assert.match(oats[0].name, /干重/);
  assert.equal(oats[1].quantity, 200); assert.equal(oats[1].unit, "毫升"); assert.equal(oats[1].grams, null);
  assert.match(oats[2].name, /煮熟/);
  const lunch = templateMealItems(MEAL_TEMPLATES.find(item => item.id === "lunch-chicken")!);
  assert(lunch.some(item => item.name.includes("生重") && item.quantity === 100));
  assert(lunch.some(item => item.name.includes("盐") && item.quantity === .5 && item.name.includes("可按需减量")));
  assert(!lunch.some(item => item.name.includes("饮用水")), "recipe cooking water is not automatically logged as food eaten");
  for (const template of MEAL_TEMPLATES) {
    const items = templateMealItems(template);
    assert.equal(items.length, template.ingredients.filter(ingredient => ingredient.name !== "饮用水").length);
    assert(items.every(item => item.quantity > 0 && item.name.length <= 200 && item.unit.length <= 80 && !item.foodSnapshot && item.foodId === null));
    const copy = templateMealItems(template);
    assert(items.every((item, index) => item.id !== copy[index].id));
  }
  const unknown: MealTemplate = { ...MEAL_TEMPLATES[0], ingredients: [{ name: "自定义食材", amount: "少许" }] };
  assert.equal(templateMealItems(unknown)[0].unit, "份（少许）");
  const range: MealTemplate = { ...unknown, ingredients: [{ name: "自定义食材", amount: "100–150 克" }] };
  assert.equal(templateMealItems(range)[0].grams, null);
  assert.equal(templateMealItems(range)[0].unit, "份（100–150 克）");
});
