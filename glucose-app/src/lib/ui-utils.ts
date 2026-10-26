import type { Meal, Profile, Reading, ReadingContext, Unit } from "./domain";
import { dateKey, toLocalDateTime } from "./domain";

export const contexts: Record<ReadingContext, string> = { fasting: "空腹", "before-meal": "餐前", "after-meal": "餐后", bedtime: "睡前", random: "随机" };
export const mealNames = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
export function dayKey(value = new Date().toISOString(), timezone = "Asia/Shanghai") {
  return dateKey(value, timezone);
}
export function inputTime(value = new Date().toISOString(), timezone = "Asia/Shanghai") {
  return toLocalDateTime(value, timezone);
}
export function timeLabel(value: string, timezone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
export function displayValue(reading: Reading, unit: Unit = "mmol/L") {
  if (reading.special) return reading.special;
  if (reading.standardValue === null) return "—";
  return unit === "mg/dL" ? String(Math.round(reading.standardValue * 18)) : reading.standardValue.toFixed(1);
}
export function readingStatus(reading: Reading, profile: Profile | null) {
  const target = profile?.targets[reading.context];
  if (!target || reading.standardValue === null) return { label: "已记录", className: "neutral" };
  if (reading.standardValue < target.min) return { label: "低于自设范围", className: "amber" };
  if (reading.standardValue > target.max) return { label: "高于自设范围", className: "amber" };
  return { label: "在自设范围内", className: "green" };
}
export function downloadCsv(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function mealSummary(meal: Meal) { return meal.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join(" · "); }
export function uuid() { return crypto.randomUUID(); }
