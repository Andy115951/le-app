import assert from "node:assert/strict";
import test from "node:test";
import { FOODS } from "../data/foods";
import { MEAL_TEMPLATES } from "../data/meal-templates";
import { createDemoData } from "../data/demo";
import { addDays, convertGlucose, csvCell, dateKey, estimateGL, exportRecordsCsv, filterTemplates, giBand, localDateTimeToIso, mealInterval, parseReading, recommendMeals, toLocalDateTime } from "./domain";
import type { MealTemplate, Profile, Reading } from "./domain";

const profile: Profile = { id: "member-a", name: "本人", timezone: "Asia/Shanghai", unit: "mmol/L", allergies: [], avoidances: [], preferences: [], maxCookingMinutes: null, targets: {} };

test("GI boundaries and missing data do not turn absent GI into zero", () => {
  assert.equal(giBand(55), "low");
  assert.equal(giBand(55.4), "medium");
  assert.equal(giBand(69), "medium");
  assert.equal(giBand(70), "high");
  assert.equal(giBand(109), "high");
  for (const missing of [null, NaN, -1, Infinity]) assert.equal(giBand(missing), "unknown");
});

test("GL uses same-food available carbohydrate and actual grams only", () => {
  const rice = FOODS.find((food) => food.id === "rice-white")!;
  assert.equal(estimateGL(rice, 230), 41.5);
  assert.equal(estimateGL(rice, 115), 20.8);
  assert.equal(estimateGL(rice, null), null);
  assert.equal(estimateGL({ ...rice, carbBasis: "unknown" }, 230), null);
  assert.equal(estimateGL({ ...rice, availableCarbsPer100g: null }, 230), null);
  assert.equal(estimateGL({ ...rice, giStatus: "not-applicable" }, 230), null);
  assert.equal(estimateGL(rice, -1), null);
  assert.equal(estimateGL(rice, NaN), null);
});

test("glucose keeps the original unit and value, special readings have no fabricated numeric value", () => {
  assert.deepEqual(parseReading(" 108 ", "mg/dL"), { value: 108, unit: "mg/dL", standardValue: 6, special: null });
  assert.equal(convertGlucose(6, "mmol/L", "mg/dL"), 108);
  assert.equal(convertGlucose(108, "mg/dL", "mmol/L"), 6);
  assert.deepEqual(parseReading(" hi ", "mmol/L"), { value: null, unit: "mmol/L", standardValue: null, special: "HI" });
  assert.equal(parseReading("lo", "mg/dL").special, "LO");
  assert.equal(parseReading("60", "mmol/L").value, 60, "unusual but real readings can be retained after UI confirmation");
  for (const input of ["", "0", "-2", "Infinity", "NaN", "1e2", "7,3", "7abc"]) assert.throws(() => parseReading(input, "mmol/L"));
});

test("dates belong to profile timezone, independent of host timezone", () => {
  const iso = "2026-10-18T16:05:00.000Z";
  assert.equal(dateKey(iso, "Asia/Shanghai"), "2026-10-19");
  assert.equal(dateKey(iso, "America/Los_Angeles"), "2026-10-18");
  assert.equal(toLocalDateTime(iso, "Asia/Shanghai"), "2026-10-19T00:05");
  assert.equal(localDateTimeToIso("2026-10-19T00:05", "Asia/Shanghai"), iso);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  for (const input of ["2026-02-29T10:00", "2026-10-19T24:00", "2026-02-30T01:00", "2026-10-19T11:60"]) assert.throws(() => localDateTimeToIso(input));
  assert.throws(() => addDays("2026-02-30", 1));
});

test("DST skipped and repeated wall times are rejected rather than silently shifted", () => {
  assert.throws(() => localDateTimeToIso("2026-03-08T02:30", "America/New_York"), /不存在/);
  assert.throws(() => localDateTimeToIso("2026-11-01T01:30", "America/New_York"), /重复/);
  assert.equal(localDateTimeToIso("2026-11-01T03:30", "America/New_York"), "2026-11-01T08:30:00.000Z");
});

test("meal intervals preserve manual/unknown semantics and expose conflicts", () => {
  assert.deepEqual(mealInterval("2026-10-19T04:30Z", "2026-10-19T02:30Z"), { minutes: 120, source: "calculated", conflict: false });
  assert.deepEqual(mealInterval("2026-10-19T04:30Z", null, 90), { minutes: 90, source: "manual", conflict: false });
  assert.deepEqual(mealInterval("2026-10-19T04:30Z", null), { minutes: null, source: "unknown", conflict: false });
  assert.equal(mealInterval("2026-10-19T04:30Z", "2026-10-19T02:30Z", 90).conflict, true);
  assert.throws(() => mealInterval("2026-10-19T02:29:59Z", "2026-10-19T02:30:00Z"), /早于/);
  assert.throws(() => mealInterval("2026-10-19T04:30Z", null, -1));
});

test("recommendations apply allergy, unknown-allergen, avoidance, vegan and cooking-time restrictions before ranking", () => {
  const base = MEAL_TEMPLATES[0];
  const unknown: MealTemplate = { ...base, id: "unknown", allergens: [], allergensComplete: false };
  assert.equal(filterTemplates([unknown], { ...profile, allergies: ["牛奶"] }).length, 0);
  const milkFree = filterTemplates(MEAL_TEMPLATES, { ...profile, allergies: ["牛奶"] });
  assert(milkFree.length > 0);
  assert(milkFree.every((t) => !t.allergens.includes("牛奶")));
  const wheatFree = filterTemplates(MEAL_TEMPLATES, { ...profile, allergies: ["小麦"] });
  assert(wheatFree.every((t) => !t.allergens.includes("小麦")));
  const sauce: MealTemplate = { ...base, id: "sauce", ingredients: [{ name: "生抽", amount: "5 毫升" }], allergens: [] };
  assert.equal(filterTemplates([sauce], { ...profile, allergies: ["大豆"] }).length, 0, "a condiment cannot bypass an allergy");
  const vegan = filterTemplates(MEAL_TEMPLATES, { ...profile, preferences: ["纯素"], maxCookingMinutes: 20 });
  assert(vegan.length > 0 && vegan.every((t) => t.tags.includes("纯素") && t.minutes <= 20));
  const withoutMushrooms = filterTemplates(MEAL_TEMPLATES, { ...profile, avoidances: ["香菇"] });
  assert(withoutMushrooms.every((t) => t.ingredients.every((i) => !i.name.includes("香菇"))));
  assert.equal(recommendMeals(MEAL_TEMPLATES, { ...profile, maxCookingMinutes: 1 }, "2026-10-19", "lunch"), null);
});

test("daily rotation is stable, swaps move forward and restrictions are never relaxed", () => {
  const first = recommendMeals(MEAL_TEMPLATES, profile, "2026-10-19", "lunch")!;
  assert.equal(recommendMeals(MEAL_TEMPLATES, profile, "2026-10-19", "lunch")?.id, first.id);
  assert.notEqual(recommendMeals(MEAL_TEMPLATES, profile, "2026-10-19", "lunch", 1)?.id, first.id);
  assert.equal(recommendMeals(MEAL_TEMPLATES, profile, "2026-10-20", "lunch")?.id, recommendMeals(MEAL_TEMPLATES, profile, "2026-10-19", "lunch", 1)?.id);
  const restricted = { ...profile, allergies: ["大豆", "牛奶", "鸡蛋", "小麦", "鱼", "甲壳类"], preferences: ["纯素"] };
  for (let rotation = 0; rotation < 20; rotation++) {
    const suggestion = recommendMeals(MEAL_TEMPLATES, restricted, "2026-10-19", "lunch", rotation);
    assert(suggestion === null || suggestion.allergens.length === 0);
  }
});

test("CSV escapes formulas, quoted cells, separators and line breaks without leaking other member or date", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const input of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(1)", "  =cmd", "\tformula", "\n=cmd"]) assert(csvCell(input).startsWith('"\''));
  const reading: Reading = { id: "r-a", profileId: profile.id, value: 108, unit: "mg/dL", standardValue: 6, special: null, measuredAt: "2026-10-18T16:05:00Z", context: "fasting", mealId: null, postMealMinutes: null, intervalSource: "unknown", notes: "=HYPERLINK(\"unsafe\")" };
  const csv = exportRecordsCsv([reading, { ...reading, id: "private-other-member", profileId: "member-b" }, { ...reading, id: "outside-range", measuredAt: "2026-10-18T15:59:00Z" }], [], profile, "2026-10-19", "2026-10-19");
  assert(csv.startsWith("\uFEFF"));
  assert(csv.includes('"108","mg/dL","6"'));
  assert(csv.includes("'=HYPERLINK"));
  assert(!csv.includes("private-other-member") && !csv.includes("outside-range"));
  assert.throws(() => exportRecordsCsv([], [], profile, "2026-10-20", "2026-10-19"));
});

test("catalog has traceable numeric GI, separate missing states and usable templates for every meal", () => {
  assert(FOODS.length >= 30);
  assert.equal(new Set(FOODS.map((food) => food.id)).size, FOODS.length);
  for (const food of FOODS) {
    assert(food.sources.every((source) => source.url.startsWith("https://") && source.checkedAt && source.reuse));
    if (food.giStatus === "known") assert(food.gi !== null && food.sources[0].detail?.includes("表 1"));
    else assert.equal(food.gi, null);
    if (food.availableCarbsPer100g !== null) assert(food.carbBasis === "available" && food.sources[0].detail?.includes("实验份量"));
  }
  assert(FOODS.some((f) => f.giStatus === "unknown") && FOODS.some((f) => f.giStatus === "not-applicable"));
  assert(MEAL_TEMPLATES.length >= 12 && MEAL_TEMPLATES.length <= 20);
  for (const type of ["breakfast", "lunch", "dinner"] as const) {
    assert(filterTemplates(MEAL_TEMPLATES, profile, type).length >= 3);
    assert(filterTemplates(MEAL_TEMPLATES, { ...profile, preferences: ["纯素"] }, type).length > 0);
  }
  for (const template of MEAL_TEMPLATES) assert(template.ingredients.length >= 4 && template.ingredients.every((i) => i.amount.trim()) && template.allergensComplete && template.sources.length);
});

test("demo is synthetic, has no prescribed targets or future entries, and relations stay in the same member", () => {
  const now = new Date("2026-10-19T00:01:00Z");
  const demo = createDemoData(now);
  assert(demo.readings.length > 0);
  assert(demo.profiles.every((p) => p.name.includes("演示") && Object.keys(p.targets).length === 0));
  assert(demo.readings.every((r) => new Date(r.measuredAt) <= now && r.notes.includes("演示")));
  assert(demo.meals.every((m) => new Date(m.startedAt) <= now));
  for (const reading of demo.readings) if (reading.mealId) {
    const meal = demo.meals.find((entry) => entry.id === reading.mealId)!;
    assert(meal && meal.profileId === reading.profileId);
    assert.equal(mealInterval(reading.measuredAt, meal.startedAt).minutes, reading.postMealMinutes);
  }
});
