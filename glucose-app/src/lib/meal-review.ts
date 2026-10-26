import type { Meal, Reading } from "./domain";

/** Association is explicit: never infer a meal from a date or nearby time. */
export function readingsForMeal(meal: Meal, readings: Reading[]): Reading[] {
  return readings.filter(reading => reading.profileId === meal.profileId && reading.mealId === meal.id)
    .sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt) || a.id.localeCompare(b.id));
}

export function timingFromMeal(meal: Meal, reading: Reading): string {
  const minutes = Math.round((Date.parse(reading.measuredAt) - Date.parse(meal.startedAt)) / 60000);
  if (!Number.isFinite(minutes)) return "请核对记录时间";
  if (minutes === 0) return "用餐开始时";
  return `用餐${minutes < 0 ? "前" : "后"} ${Math.abs(minutes)} 分钟`;
}
