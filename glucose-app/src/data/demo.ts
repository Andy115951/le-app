import { addDays, dateKey, localDateTimeToIso } from "../lib/domain";
import type { Meal, Profile, Reading, ReadingContext } from "../lib/domain";

/** Synthetic examples only. They stay in memory and must never be uploaded as real records. */
export function createDemoData(now = new Date()): { profiles: Profile[]; readings: Reading[]; meals: Meal[] } {
  const profiles: Profile[] = [
    { id: "demo-self", name: "我（演示）", timezone: "Asia/Shanghai", unit: "mmol/L", allergies: [], avoidances: [], preferences: ["均衡"], maxCookingMinutes: null, targets: {} },
    { id: "demo-family", name: "家人（演示）", timezone: "Asia/Shanghai", unit: "mmol/L", allergies: ["牛奶"], avoidances: [], preferences: ["快手"], maxCookingMinutes: 20, targets: {} },
  ];
  const today = dateKey(now);
  const meals: Meal[] = [];
  const readings: Reading[] = [];
  const times: { clock: string; context: ReadingContext }[] = [{ clock: "07:00", context: "fasting" }, { clock: "09:30", context: "after-meal" }, { clock: "14:00", context: "after-meal" }, { clock: "21:00", context: "bedtime" }];
  const syntheticValues = [5.7, 7.2, 7.8, 6.1, 5.8, 7.4, 7.6, 6.3, 6.1, 7.1, 8.0, 6.5, 5.9, 7.5, 7.7, 6.2, 5.8, 7.0, 7.4, 6.0, 6.0, 7.3, 7.9, 6.4, 5.9, 7.4, 7.6, 6.2];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const day = addDays(today, dayIndex - 6);
    const breakfastId = `demo-meal-${day}-breakfast`;
    const lunchId = `demo-meal-${day}-lunch`;
    meals.push(
      { id: breakfastId, profileId: "demo-self", type: "breakfast", startedAt: localDateTimeToIso(`${day}T07:30`), notes: "演示数据：展示早餐与餐后测量的关联", templateId: "breakfast-oats", items: [{ id: `${breakfastId}-1`, foodId: "oats-plain", name: "原味燕麦片（干重）", quantity: 35, unit: "克", grams: 35 }, { id: `${breakfastId}-2`, foodId: "milk-plain", name: "纯牛奶", quantity: 200, unit: "毫升", grams: null }, { id: `${breakfastId}-3`, foodId: "egg", name: "水煮鸡蛋", quantity: 1, unit: "个", grams: null }, { id: `${breakfastId}-4`, foodId: "cucumber", name: "黄瓜", quantity: 100, unit: "克", grams: 100 }] },
      { id: lunchId, profileId: "demo-self", type: "lunch", startedAt: localDateTimeToIso(`${day}T12:00`), notes: "演示数据，份量仅用于展示", templateId: "lunch-chicken", items: [{ id: `${lunchId}-1`, foodId: "rice-brown", name: "糙米饭（熟重）", quantity: 100, unit: "克", grams: 100 }, { id: `${lunchId}-2`, foodId: "chicken", name: "去皮鸡胸肉（生重）", quantity: 100, unit: "克", grams: 100 }, { id: `${lunchId}-3`, foodId: "broccoli", name: "西兰花", quantity: 200, unit: "克", grams: 200 }] },
    );
    times.forEach(({ clock, context }, timeIndex) => {
      const value = syntheticValues[dayIndex * 4 + timeIndex];
      readings.push({ id: `demo-reading-${day}-${timeIndex}`, profileId: "demo-self", value, unit: "mmol/L", standardValue: value, special: null, measuredAt: localDateTimeToIso(`${day}T${clock}`), context, mealId: timeIndex === 1 ? breakfastId : timeIndex === 2 ? lunchId : null, postMealMinutes: context === "after-meal" ? 120 : null, intervalSource: context === "after-meal" ? "calculated" : "unknown", notes: "合成演示读数，不代表健康目标或测量结果" });
    });
  }
  // Today is shown only up to the user's current time: no future meals/measurements.
  const existingMeals = meals.filter((meal) => new Date(meal.startedAt).getTime() <= now.getTime());
  const mealIds = new Set(existingMeals.map((meal) => meal.id));
  return { profiles, meals: existingMeals, readings: readings.filter((reading) => new Date(reading.measuredAt).getTime() <= now.getTime() && (!reading.mealId || mealIds.has(reading.mealId))) };
}
