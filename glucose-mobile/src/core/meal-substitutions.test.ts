import assert from "node:assert/strict";
import test from "node:test";
import { MEAL_TEMPLATES } from "../data/meal-templates";
import { SWAP_FOOD_BY_NAME } from "../data/meal-substitutions";
import { filterTemplates, type MealTemplate, type Profile } from "./domain";
import { mealSwapChoices, parseMealSwaps, resolveMealSwaps } from "./meal-substitutions";
import { templateMealItems } from "./meal-suggestions";
const profile: Profile = { id: "test", name: "测试", timezone: "Asia/Shanghai", unit: "mmol/L", allergies: [], avoidances: [], preferences: [], maxCookingMinutes: null, targets: {} };
const recipe = (id: string) => MEAL_TEMPLATES.find(item => item.id === id)!;

test("all recipe ingredients have explicit roles and allergen metadata before swaps are offered", () => {
  for (const template of MEAL_TEMPLATES) {
    for (const ingredient of template.ingredients) assert(SWAP_FOOD_BY_NAME.has(ingredient.name), `${template.id}: ${ingredient.name}`);
    const roles = template.ingredients.map(ingredient => SWAP_FOOD_BY_NAME.get(ingredient.name)!.role);
    assert(["staple", "protein", "vegetable"].every(role => roles.includes(role as typeof roles[number])));
  }
});

test("one vegetable swap preserves every other food and seasoning, updates the title and restores the original exactly", () => {
  const base = recipe("lunch-chicken"); const snapshot = JSON.stringify(base);
  const next = resolveMealSwaps(base, { 2: "spinach" }, profile);
  assert.equal(next.ingredients[2].name, "菠菜"); assert.match(next.ingredients[2].amount, /200 克/);
  next.ingredients.forEach((ingredient, index) => { if (index !== 2) assert.deepEqual(ingredient, base.ingredients[index]); });
  assert(!next.name.includes("西兰花")); assert(next.name.includes("菠菜"));
  assert.equal(JSON.stringify(base), snapshot);
  assert.deepEqual(resolveMealSwaps(base, {}, profile), base);
  assert(!mealSwapChoices(base, {}, 2, profile).some(choice => choice.id === "carrot"), "existing carrot cannot be added again");
});

test("swaps recompute all allergens and dietary tags instead of inheriting stale flags", () => {
  const fish = recipe("lunch-fish");
  const plant = resolveMealSwaps(fish, { 1: "tofu" }, { ...profile, allergies: ["鱼"] });
  assert.deepEqual(plant.allergens, ["大豆"]); assert(plant.tags.includes("纯素")); assert(!plant.tags.includes("含鱼"));
  const milk = resolveMealSwaps(recipe("breakfast-yam"), { 1: "milk" }, profile);
  assert(milk.allergens.includes("牛奶") && milk.allergens.includes("大豆"), "unchanged tofu still contributes soy");
  assert(milk.tags.includes("蛋奶素") && !milk.tags.includes("纯素"));
  const soy = resolveMealSwaps(recipe("breakfast-oats"), { 1: "soymilk" }, { ...profile, allergies: ["牛奶"] });
  assert(!soy.allergens.includes("牛奶") && soy.allergens.includes("鸡蛋") && soy.allergens.includes("大豆"));
});

test("every alternative respects allergy, avoidance, vegetarian requirements and cooking time after the full change", () => {
  const base = recipe("breakfast-yam");
  assert(!mealSwapChoices(base, {}, 1, { ...profile, allergies: ["牛奶"] }).some(item => item.id === "milk"));
  assert(!mealSwapChoices(base, {}, 2, { ...profile, preferences: ["纯素"] }).some(item => ["egg", "chicken", "fish", "shrimp", "beef", "pork"].includes(item.id)));
  const vegetarian = mealSwapChoices(base, {}, 2, { ...profile, preferences: ["素食"] });
  assert(vegetarian.some(item => item.id === "egg")); assert(!vegetarian.some(item => ["chicken", "fish", "shrimp", "beef", "pork"].includes(item.id)));
  assert(!mealSwapChoices(recipe("lunch-chicken"), {}, 2, { ...profile, avoidances: ["菠菜"] }).some(item => item.id === "spinach"));
  assert(!mealSwapChoices(recipe("breakfast-oats"), {}, 2, { ...profile, maxCookingMinutes: 20 }).some(item => item.id === "chicken"));
  for (const choice of mealSwapChoices(base, {}, 2, { ...profile, maxCookingMinutes: 20 })) {
    const changed = resolveMealSwaps(base, choice.swaps, { ...profile, maxCookingMinutes: 20 });
    assert(changed.minutes <= 20 && filterTemplates([changed], { ...profile, maxCookingMinutes: 20 }).length === 1);
  }
});

test("sequential substitutions survive a route round trip and conversion to an independent meal draft", () => {
  const base = recipe("lunch-chicken");
  const first = mealSwapChoices(base, {}, 2, profile).find(item => item.id === "spinach")!;
  const second = mealSwapChoices(base, first.swaps, 0, profile).find(item => item.id === "millet")!;
  const plan = resolveMealSwaps(base, parseMealSwaps(JSON.stringify(second.swaps)), profile);
  const draft = templateMealItems(plan);
  assert(draft.some(item => item.name === "小米饭（熟重）" && item.quantity === 100));
  assert(draft.some(item => item.name.includes("菠菜") && item.quantity === 200));
  assert(draft.every(item => !item.foodSnapshot && item.foodId === null));
  const revert = mealSwapChoices(base, second.swaps, 2, profile).find(item => item.id === "broccoli")!;
  assert.deepEqual(revert.swaps, { 0: "millet" });
  assert.deepEqual(resolveMealSwaps(base, revert.swaps, profile).ingredients[2], base.ingredients[2]);
});

test("invalid or tampered route data cannot cross food roles, change condiments, bypass restrictions or turn ranges into exact portions", () => {
  for (const raw of ["[]", "null", "not json", '{"-1":"spinach"}', '{"0":"not-known"}', '{"__proto__":"spinach"}', '{"00":"spinach"}']) assert.throws(() => parseMealSwaps(raw));
  const base = recipe("lunch-chicken");
  assert.throws(() => resolveMealSwaps(base, { 0: "spinach" }, profile));
  assert.throws(() => resolveMealSwaps(base, { 99: "spinach" }, profile));
  assert.throws(() => resolveMealSwaps(base, { 6: "spinach" }, profile));
  assert.throws(() => resolveMealSwaps(base, { 2: "spinach" }, { ...profile, avoidances: ["菠菜"] }));
  assert.throws(() => resolveMealSwaps(recipe("breakfast-yam"), { 1: "milk" }, { ...profile, allergies: ["牛奶"] }));
  const ranged: MealTemplate = { ...base, ingredients: base.ingredients.map((ingredient, i) => i === 2 ? { ...ingredient, amount: "100–200 克" } : ingredient) };
  assert.equal(mealSwapChoices(ranged, {}, 2, profile).length, 0);
});
