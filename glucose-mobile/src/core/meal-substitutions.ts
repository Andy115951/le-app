import { filterTemplates, type MealTemplate, type Profile } from "./domain";
import { cloneData } from "./runtime";
import { SWAP_FOOD_BY_ID, SWAP_FOOD_BY_NAME, SWAP_FOODS, type SwapFood } from "../data/meal-substitutions";

export type MealSwaps = Record<string, string>;
export interface MealSwapChoice { id: string; name: string; amount: string; minutes: number; swaps: MealSwaps }
type Ingredient = MealTemplate["ingredients"][number];
function described(ingredient: Ingredient): SwapFood {
  const food = SWAP_FOOD_BY_NAME.get(ingredient.name);
  if (!food) throw new Error("这项食材资料尚不完整，暂不能替换。");
  return food;
}
function replacement(original: Ingredient, target: SwapFood): Ingredient {
  if (target.amount) return { name: target.name, amount: target.amount };
  const grams = original.amount.match(/(\d+(?:\.\d+)?)\s*克/);
  if (!grams || !Number.isFinite(Number(grams[1])) || Number(grams[1]) <= 0 || /\d\s*[-–—~～至]\s*\d/.test(original.amount)) throw new Error("这项份量需要先核对，暂不能直接替换。");
  const prefix = target.group === "cooked-grain" ? "熟重 " : target.group === "root" ? "生重 " : target.group === "dry-noodle" ? "干重 " : "";
  const preparation = target.preparation?.replace(/^(熟重|生重|干重)[，\s]*/, "");
  return { name: target.name, amount: `${prefix}${grams[1]} 克${preparation ? `，${preparation}` : ""}` };
}

export function parseMealSwaps(value?: string): MealSwaps {
  if (!value) return {};
  if (value.length > 2048) throw new Error("替换信息过长，请重新选择搭配。");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("替换信息无效，请重新选择搭配。"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.entries(parsed).some(([index, id]) => !/^(0|[1-9]\d*)$/.test(index) || typeof id !== "string" || !SWAP_FOOD_BY_ID.has(id))) throw new Error("替换信息无效，请重新选择搭配。");
  return parsed as MealSwaps;
}

/** Rebuild from the original every time: unchanged ingredients stay byte-for-byte intact. */
export function resolveMealSwaps(base: MealTemplate, swaps: MealSwaps, profile: Profile): MealTemplate {
  const checked = parseMealSwaps(JSON.stringify(swaps));
  const ingredients = cloneData(base.ingredients);
  const changes: { from: SwapFood; to: SwapFood }[] = [];
  for (const [indexText, id] of Object.entries(checked)) {
    const index = Number(indexText);
    if (!ingredients[index]) throw new Error("替换的食材已变化，请重新选择。");
    const from = described(base.ingredients[index]); const to = SWAP_FOOD_BY_ID.get(id)!;
    if (from.role === "seasoning" || from.group !== to.group) throw new Error("只能替换为这项食物支持的同类食材。");
    if (from.id === to.id) continue;
    ingredients[index] = replacement(base.ingredients[index], to); changes.push({ from, to });
  }
  if (!changes.length) {
    if (!filterTemplates([base], profile).length) throw new Error("搭配不再符合当前成员条件，请重新选择。");
    return cloneData(base);
  }
  const foods = ingredients.map(described);
  if (new Set(foods.map(food => food.id)).size !== foods.length) throw new Error("这餐已有该食物，请换一种其他食材。");
  if (!["staple", "protein", "vegetable"].every(role => foods.some(food => food.role === role))) throw new Error("替换后需保留主食、蛋白质食物和蔬菜。");
  const minutes = Math.max(base.minutes + changes.reduce((extra, { from, to }) => extra + Math.max(0, to.minutes - from.minutes), 0), ...changes.map(change => change.to.minutes));
  const dietaryTags = new Set(["纯素", "蛋奶素", "含肉", "含鱼", "含海鲜", "快手"]);
  const tags = base.tags.filter(tag => !dietaryTags.has(tag));
  if (foods.every(food => food.diet === "plant")) tags.push("纯素");
  else if (foods.every(food => food.diet !== "animal")) tags.push("蛋奶素");
  else {
    if (foods.some(food => ["chicken", "beef", "pork"].includes(food.id))) tags.push("含肉");
    if (foods.some(food => food.id === "fish")) tags.push("含鱼");
    if (foods.some(food => food.id === "shrimp")) tags.push("含海鲜");
  }
  if (minutes <= 15) tags.push("快手");
  const staples = foods.filter(food => food.role === "staple").map(food => food.label).join("、");
  const proteins = foods.filter(food => food.role === "protein").map(food => food.label).join("、");
  const vegetables = foods.filter(food => food.role === "vegetable").map(food => food.label).join("、");
  const updated: MealTemplate = {
    ...cloneData(base), name: `${staples} · ${proteins}配${vegetables}`, ingredients, minutes, tags,
    allergens: [...new Set(foods.flatMap(food => food.allergens))], allergensComplete: true,
    excludedFor: [...new Set(foods.flatMap(food => food.exclusions))],
    reason: `保留本餐主食、蛋白质食物和蔬菜的位置，已按当前过敏、忌口和饮食要求重新检查。`,
    swaps: ["替换食材按列出的方式单独做好后配餐，其他食物和调味保持原样；蒸煮用水另备，不额外添加酱料。", "份量是同类搭配示例，不表示热量或碳水等量；记餐时按实际吃下的份量调整。", "请核对实际包装配料与交叉接触；生熟重按食材说明记录。"],
  };
  if (!filterTemplates([updated], profile).length) throw new Error("替换后不符合当前过敏、忌口、素食或做饭时间限制。");
  return updated;
}

export function supportsMealSwap(ingredient: Ingredient): boolean {
  const food = SWAP_FOOD_BY_NAME.get(ingredient.name);
  return !!food && food.role !== "seasoning" && SWAP_FOODS.some(other => other.group === food.group && other.id !== food.id);
}

export function mealSwapChoices(base: MealTemplate, swaps: MealSwaps, index: number, profile: Profile): MealSwapChoice[] {
  const original = base.ingredients[index]; if (!original) return [];
  const from = SWAP_FOOD_BY_NAME.get(original.name); if (!from || from.role === "seasoning") return [];
  const currentId = swaps[String(index)] || from.id;
  return SWAP_FOODS.filter(food => food.group === from.group && food.id !== currentId).flatMap(food => {
    const next = { ...swaps }; if (food.id === from.id) delete next[String(index)]; else next[String(index)] = food.id;
    try {
      const variant = resolveMealSwaps(base, next, profile);
      return [{ id: food.id, name: variant.ingredients[index].name, amount: variant.ingredients[index].amount, minutes: variant.minutes, swaps: next }];
    } catch { return []; }
  });
}
