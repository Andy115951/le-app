import { FOOD_BY_ID } from "@/data/foods";
import type { Food, MealTemplate } from "./domain";

export type FoodVisual = { label: string; image?: string };

function image(id: string) {
  return `/images/foods/${id}.webp`;
}

// Each catalog item has its own image, including distinct preparations.
export const FOOD_VISUALS: Record<string, FoodVisual> = {
  "rice-white": { label: "白米饭", image: image("rice-white") },
  "rice-brown": { label: "糙米饭", image: image("rice-brown") },
  "bread-wholemeal": { label: "全麦面包", image: image("bread-wholemeal") },
  "noodles-wheat": { label: "小麦面", image: image("noodles-wheat") },
  "potato-steamed": { label: "蒸土豆", image: image("potato-steamed") },
  "yam-steamed": { label: "山药", image: image("yam-steamed") },
  "corn-sweet": { label: "甜玉米", image: image("corn-sweet") },
  "millet-cooked": { label: "小米饭", image: image("millet-cooked") },
  "millet-porridge": { label: "小米粥", image: image("millet-porridge") },
  "adzuki-boiled": { label: "红小豆", image: image("adzuki-boiled") },
  "apple-red": { label: "苹果", image: image("apple-red") },
  "watermelon-red": { label: "西瓜", image: image("watermelon-red") },
  "sweet-potato-boiled": { label: "水煮红薯", image: image("sweet-potato-boiled") },
  "sweet-potato-baked": { label: "烤红薯", image: image("sweet-potato-baked") },
  "oats-plain": { label: "燕麦片", image: image("oats-plain") },
  "bun-wholemeal": { label: "全麦馒头", image: image("bun-wholemeal") },
  "milk-plain": { label: "纯牛奶", image: image("milk-plain") },
  "yogurt-plain": { label: "无糖酸奶", image: image("yogurt-plain") },
  "soymilk-plain": { label: "无糖豆浆", image: image("soymilk-plain") },
  banana: { label: "香蕉", image: image("banana") },
  orange: { label: "橙子", image: image("orange") },
  "mung-bean": { label: "绿豆", image: image("mung-bean") },
  "noodles-buckwheat": { label: "荞麦面", image: image("noodles-buckwheat") },
  cucumber: { label: "黄瓜", image: image("cucumber") },
  broccoli: { label: "西兰花", image: image("broccoli") },
  spinach: { label: "菠菜", image: image("spinach") },
  egg: { label: "鸡蛋", image: image("egg") },
  chicken: { label: "鸡胸肉", image: image("chicken") },
  fish: { label: "鱼肉", image: image("fish") },
  walnut: { label: "核桃", image: image("walnut") },
  tofu: { label: "豆腐", image: image("tofu") },
  tomato: { label: "番茄", image: image("tomato") },
};

// Recipe ingredients may use a form that differs from the catalog reference.
// These explicit names keep corn kernels separate from a cob and steamed
// sweet potato separate from the boiled and baked catalog samples.
const INGREDIENT_IMAGES: Record<string, string> = {
  "甜玉米粒": image("corn-kernels"),
  "红薯": image("sweet-potato-steamed"),
  "胡萝卜": image("carrot"),
  "全麦小麦粉": image("wholemeal-flour"),
  "原味瘦牛肉": image("beef"),
  "鲜香菇": image("shiitake"),
  "原味瘦猪肉": image("pork"),
  "原味虾仁": image("shrimp"),
  "食用小扁豆": image("lentil"),
};

function shortName(name: string) {
  return name.replace(/（[^）]*）|\([^)]*\)/g, "").trim() || name;
}

export function foodVisual(food: Pick<Food, "id" | "name">): FoodVisual {
  return FOOD_VISUALS[food.id] ?? { label: shortName(food.name) };
}

export function ingredientVisual(ingredient: MealTemplate["ingredients"][number]): FoodVisual {
  const label = shortName(ingredient.name);
  const food = ingredient.foodId ? FOOD_BY_ID[ingredient.foodId] : undefined;
  return { label, image: INGREDIENT_IMAGES[label] ?? (food ? foodVisual(food).image : undefined) };
}

export function recipeVisuals(template: Pick<MealTemplate, "ingredients">): FoodVisual[] {
  // Show available photographs of actual ingredients. The full ingredient
  // list below the pictures remains the complete recipe, including seasonings.
  return template.ingredients.map(ingredientVisual).filter(visual => !!visual.image).slice(0, 3);
}
