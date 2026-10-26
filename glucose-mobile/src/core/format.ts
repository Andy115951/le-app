import { dateKey } from "./domain";
import type { Meal, Reading, ReadingContext, Unit } from "./domain";
export const contexts: Record<ReadingContext, string> = { fasting: "空腹", "before-meal": "餐前", "after-meal": "餐后", bedtime: "睡前", random: "随机" };
export const mealNames = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
export function dayKey(value = new Date().toISOString(), timezone = "Asia/Shanghai") { return dateKey(value, timezone); }
export function timeLabel(value: string, timezone = "Asia/Shanghai", full = false) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, ...(full ? { month: "numeric", day: "numeric" } as const : {}), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
export function displayValue(reading: Reading, unit: Unit = "mmol/L") {
  if (reading.special) return reading.special;
  if (reading.standardValue === null) return "—";
  return unit === "mg/dL" ? String(Math.round(reading.standardValue * 18)) : reading.standardValue.toFixed(1);
}
export function mealSummary(meal: Meal) { return meal.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join(" · "); }
