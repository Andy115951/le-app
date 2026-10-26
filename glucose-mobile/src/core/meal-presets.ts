import { uuid, cloneData } from "./runtime";
import type { MealItem, MealType } from "./domain";

/** A reusable member-owned food snapshot, independent of any dated meal record. */
export interface MealPreset {
  id: string;
  profileId: string;
  name: string;
  mealType: MealType;
  items: MealItem[];
  createdAt?: string;
  updatedAt?: string;
}

/** Every application gets independent items and snapshots, including new item IDs. */
export function cloneMealItems(items: readonly MealItem[]): MealItem[] {
  return items.map(item => ({ ...cloneData(item), id: uuid() }));
}

const mealTypes = new Set<MealType>(["breakfast", "lunch", "dinner", "snack"]);
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && [...value.trim()].length >= 1 && [...value.trim()].length <= max;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function nullableNumber(value: unknown, max = Infinity): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max);
}

/** Shared by the form/provider; the database separately enforces the same boundary. */
export function validateMealPreset(preset: MealPreset): void {
  if (!preset || !text(preset.id, 200) || !text(preset.profileId, 200)) throw new Error("常吃组合或成员已变化，请重新打开后再试。");
  if (!text(preset.name, 60)) throw new Error("请输入 1–60 字的组合名称。");
  if (!mealTypes.has(preset.mealType)) throw new Error("请选择这个组合适用的餐次。");
  if (!Array.isArray(preset.items) || preset.items.length < 1 || preset.items.length > 100) throw new Error("常吃组合需包含 1–100 种食物。");
  const ids = new Set<string>();
  for (const item of preset.items) {
    if (!item || !text(item.id, 200) || ids.has(item.id)) throw new Error("组合食物已变化，请重新添加食物后再试。");
    ids.add(item.id);
    if (!text(item.name, 200)) throw new Error("请为组合中的每一种食物填写完整名称，最多 200 字。");
    if (!positive(item.quantity) || !text(item.unit, 80)) throw new Error("请核对每种食物的份量与单位，份量需大于 0。");
    if (item.grams !== null && !positive(item.grams)) throw new Error("食物克重需大于 0；无法确定时请留空。");
    if (item.foodId !== null && !text(item.foodId, 200)) throw new Error("食物关联无效，请重新选择食物。");
    if (item.foodSnapshot !== undefined) {
      const snapshot = item.foodSnapshot;
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)
        || !["known", "unknown", "not-applicable"].includes(snapshot.giStatus)
        || !nullableNumber(snapshot.gi) || !nullableNumber(snapshot.availableCarbsPer100g, 100)
        || (snapshot.giStatus === "known" ? snapshot.gi === null : snapshot.gi !== null)) {
        throw new Error("食物数据快照无效，请重新选择该食物。");
      }
    }
  }
}
