export type Unit = "mmol/L" | "mg/dL";
export type ReadingContext = "fasting" | "before-meal" | "after-meal" | "bedtime" | "random";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type GIStatus = "known" | "unknown" | "not-applicable";

export interface Source {
  title: string;
  url: string;
  checkedAt: string;
  reuse: string;
  detail?: string;
}

export interface Food {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  preparation: string;
  portionLabel: string;
  portionGrams: number | null;
  gi: number | null;
  giStatus: GIStatus;
  availableCarbsPer100g: number | null;
  carbBasis: "available" | "unknown";
  sources: Source[];
  notes: string;
}

export interface MealTemplate {
  id: string;
  name: string;
  mealTypes: MealType[];
  ingredients: { name: string; amount: string; foodId?: string }[];
  allergens: string[];
  allergensComplete: boolean;
  excludedFor: string[];
  tags: string[];
  minutes: number;
  reason: string;
  swaps: string[];
  sources: Source[];
}

export interface Profile {
  id: string;
  name: string;
  timezone: string;
  unit: Unit;
  allergies: string[];
  avoidances: string[];
  preferences: string[];
  maxCookingMinutes: number | null;
  /** Targets always use mmol/L, independent of display unit. */
  targets: Partial<Record<ReadingContext, { min: number; max: number }>>;
}

export interface Reading {
  id: string;
  profileId: string;
  value: number | null;
  unit: Unit;
  standardValue: number | null;
  special: "HI" | "LO" | null;
  measuredAt: string;
  context: ReadingContext;
  mealId: string | null;
  postMealMinutes: number | null;
  intervalSource: "calculated" | "manual" | "unknown";
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MealItem {
  id: string;
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number | null;
  foodSnapshot?: Pick<Food, "gi" | "availableCarbsPer100g" | "giStatus">;
}

export interface Meal {
  id: string;
  profileId: string;
  type: MealType;
  startedAt: string;
  notes: string;
  templateId: string | null;
  items: MealItem[];
  createdAt?: string;
  updatedAt?: string;
}

export const CONTEXT_LABELS: Record<ReadingContext, string> = {
  fasting: "空腹", "before-meal": "餐前", "after-meal": "餐后", bedtime: "睡前", random: "随机",
};
export const MEAL_LABELS: Record<MealType, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
export const FOOD_CATEGORIES = ["米面杂粮", "粥粉面", "薯类豆类", "水果", "乳制品", "饮料", "蔬菜", "肉蛋鱼豆", "坚果零食"];
export const ALLERGENS = ["牛奶", "鸡蛋", "大豆", "小麦", "花生", "坚果", "鱼", "甲壳类", "芝麻"];
export const PREFERENCES = ["均衡", "素食", "纯素", "少油", "快手", "不辣"];

export function giBand(gi: number | null): "low" | "medium" | "high" | "unknown" {
  if (gi === null || !Number.isFinite(gi) || gi < 0) return "unknown";
  return gi <= 55 ? "low" : gi < 70 ? "medium" : "high";
}

/** Only matching available-carbohydrate data may be used; never assume missing data is zero. */
export function estimateGL(food: Pick<Food, "gi" | "giStatus" | "availableCarbsPer100g" | "carbBasis">, grams: number | null): number | null {
  if (food.giStatus !== "known" || food.carbBasis !== "available" || food.gi === null || food.availableCarbsPer100g === null || grams === null) return null;
  if (![food.gi, food.availableCarbsPer100g, grams].every(Number.isFinite) || food.gi < 0 || food.availableCarbsPer100g < 0 || grams < 0) return null;
  return Math.round(food.gi * food.availableCarbsPer100g * grams / 10000 * 10) / 10;
}

export function convertGlucose(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("请输入有效的血糖数值");
  return from === to ? value : from === "mmol/L" ? value * 18 : value / 18;
}

export function parseReading(input: string, unit: Unit): Pick<Reading, "value" | "unit" | "standardValue" | "special"> {
  const trimmed = input.trim().toUpperCase();
  if (trimmed === "HI" || trimmed === "LO") return { value: null, unit, standardValue: null, special: trimmed };
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) throw new Error("请输入读数，或仪器显示的 HI / LO");
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) throw new Error("血糖数值需大于 0，请核对读数和单位");
  return { value, unit, standardValue: convertGlucose(value, unit, "mmol/L"), special: null };
}

function checkedDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("日期或时间无效");
  return date;
}

function zonedParts(value: string | Date, timezone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(checkedDate(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function dateKey(value: string | Date, timezone = "Asia/Shanghai"): string {
  const p = zonedParts(value, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function toLocalDateTime(value: string | Date, timezone = "Asia/Shanghai"): string {
  const p = zonedParts(value, timezone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Converts a datetime-local value in the profile timezone, rejecting skipped/ambiguous DST times. */
export function localDateTimeToIso(input: string, timezone = "Asia/Shanghai"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  if (!match) throw new Error("请选择完整的日期和时间");
  const [, y, m, d, h, min, s = "00"] = match;
  const wall = Date.UTC(+y, +m - 1, +d, +h, +min, +s);
  const calendar = new Date(wall);
  if (calendar.getUTCFullYear() !== +y || calendar.getUTCMonth() !== +m - 1 || calendar.getUTCDate() !== +d || +h > 23 || +min > 59 || +s > 59) throw new Error("日期或时间无效");
  // Sampling offsets on both sides of a transition also detects the repeated hour.
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const sample = new Date(wall + hours * 3600000);
    const p = zonedParts(sample, timezone);
    offsets.add(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - sample.getTime());
  }
  const candidates = [...offsets].map((offset) => new Date(wall - offset)).filter((candidate) => {
    const p = zonedParts(candidate, timezone);
    return p.year === y && p.month === m && p.day === d && p.hour === h && p.minute === min && p.second === s;
  });
  if (candidates.length === 0) throw new Error("此时间在所选时区不存在，请重新选择");
  if (candidates.length > 1) throw new Error("此时间处于夏令时重复时段，请换用明确的时间");
  return candidates[0].toISOString();
}

export function formatDateTime(value: string | Date, timezone = "Asia/Shanghai", dateOnly = false): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "numeric", day: "numeric", ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }) }).format(checkedDate(value));
}

export function addDays(day: string, amount: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(amount)) throw new Error("日期无效");
  const date = checkedDate(`${day}T12:00:00Z`);
  if (date.toISOString().slice(0, 10) !== day) throw new Error("日期无效");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function mealInterval(measuredAt: string, startedAt: string | null, manualMinutes: number | null = null): { minutes: number | null; source: Reading["intervalSource"]; conflict: boolean } {
  if (manualMinutes !== null && (!Number.isFinite(manualMinutes) || manualMinutes < 0 || !Number.isInteger(manualMinutes))) throw new Error("餐后分钟数需为非负整数");
  if (startedAt) {
    const elapsed = checkedDate(measuredAt).getTime() - checkedDate(startedAt).getTime();
    if (elapsed < 0) throw new Error("测量时间早于用餐开始时间，请核对");
    const minutes = Math.round(elapsed / 60000);
    return { minutes, source: "calculated", conflict: manualMinutes !== null && manualMinutes !== minutes };
  }
  return { minutes: manualMinutes, source: manualMinutes === null ? "unknown" : "manual", conflict: false };
}

const ALLERGEN_ALIASES: Record<string, string[]> = {
  牛奶: ["牛奶", "乳", "奶酪", "酸奶", "黄油"], 鸡蛋: ["鸡蛋", "蛋液", "蛋白", "蛋黄"], 大豆: ["大豆", "黄豆", "豆腐", "豆浆", "酱油", "生抽"], 小麦: ["小麦", "面包", "面条", "面粉", "酱油", "生抽"], 花生: ["花生"], 坚果: ["坚果", "核桃", "杏仁", "腰果"], 鱼: ["鱼"], 甲壳类: ["甲壳类", "虾", "蟹"], 芝麻: ["芝麻", "香油"],
};

function normalized(text: string): string { return text.trim().toLocaleLowerCase(); }

export function filterTemplates(templates: readonly MealTemplate[], profile: Profile, mealType?: MealType): MealTemplate[] {
  const allergies = profile.allergies.map(normalized).filter(Boolean);
  const avoidances = profile.avoidances.map(normalized).filter(Boolean);
  return templates.filter((template) => {
    if (mealType && !template.mealTypes.includes(mealType)) return false;
    if (profile.maxCookingMinutes !== null && template.minutes > profile.maxCookingMinutes) return false;
    if (allergies.length && !template.allergensComplete) return false;
    const ingredients = template.ingredients.map((item) => normalized(item.name));
    const searchable = [...ingredients, ...template.allergens, ...template.excludedFor].map(normalized);
    if (allergies.some((allergy) => (ALLERGEN_ALIASES[allergy] ?? [allergy]).some((alias) => searchable.some((item) => item.includes(alias))))) return false;
    if (avoidances.some((avoidance) => searchable.some((item) => item.includes(avoidance)))) return false;
    if (profile.preferences.includes("纯素") && !template.tags.includes("纯素")) return false;
    if (profile.preferences.includes("素食") && !template.tags.some((tag) => ["纯素", "蛋奶素"].includes(tag))) return false;
    return true;
  });
}

/** The same date/member/rotation gives the same suggestion; next day advances one slot. */
export function recommendMeals(templates: readonly MealTemplate[], profile: Profile, day: string, mealType: MealType, rotation = 0): MealTemplate | null {
  if (!Number.isFinite(rotation)) throw new Error("换一份的序号无效");
  const eligible = filterTemplates(templates, profile, mealType);
  if (!eligible.length) return null;
  const scored = eligible.map((template) => ({ template, score: profile.preferences.filter((p) => template.tags.includes(p)).length }));
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const pool = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.template).sort((a, b) => a.id.localeCompare(b.id));
  const validDay = addDays(day, 0);
  const epochDay = Math.floor(new Date(`${validDay}T00:00:00Z`).getTime() / 86400000);
  const memberOffset = [...profile.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const index = ((epochDay + memberOffset + Math.trunc(rotation)) % pool.length + pool.length) % pool.length;
  return pool[index];
}

/** Quote every cell and neutralize spreadsheet formulas, including leading whitespace/control chars. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportRecordsCsv(readings: readonly Reading[], meals: readonly Meal[], profile: Profile, startDay?: string, endDay?: string): string {
  if (startDay) addDays(startDay, 0);
  if (endDay) addDays(endDay, 0);
  if (startDay && endDay && startDay > endDay) throw new Error("开始日期不能晚于结束日期");
  const inRange = (time: string) => { const day = dateKey(time, profile.timezone); return (!startDay || day >= startDay) && (!endDay || day <= endDay); };
  const rows: unknown[][] = [["记录类型", "成员", "记录ID", "实际时间(UTC)", "成员本地时间", "时区", "场景/餐次", "原始血糖", "原始单位", "标准血糖(mmol/L)", "关联餐食ID", "餐后分钟", "间隔来源", "食物及份量", "备注"]];
  const records = [
    ...readings.filter((r) => r.profileId === profile.id && inRange(r.measuredAt)).map((r) => ({ time: r.measuredAt, row: ["血糖", profile.name, r.id, r.measuredAt, toLocalDateTime(r.measuredAt, profile.timezone), profile.timezone, CONTEXT_LABELS[r.context], r.special ?? r.value, r.unit, r.standardValue, r.mealId, r.postMealMinutes, r.intervalSource, "", r.notes] })),
    ...meals.filter((m) => m.profileId === profile.id && inRange(m.startedAt)).map((m) => ({ time: m.startedAt, row: ["餐饮", profile.name, m.id, m.startedAt, toLocalDateTime(m.startedAt, profile.timezone), profile.timezone, MEAL_LABELS[m.type], "", "", "", m.id, "", "", m.items.map((i) => `${i.name} ${i.quantity}${i.unit}${i.grams === null ? "" : `（${i.grams}克）`}`).join("；"), m.notes] })),
  ].sort((a, b) => checkedDate(a.time).getTime() - checkedDate(b.time).getTime());
  rows.push(...records.map((record) => record.row));
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
