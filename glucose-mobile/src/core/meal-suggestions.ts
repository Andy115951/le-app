import { addDays, filterTemplates, type MealItem, type MealTemplate, type MealType, type Profile } from "./domain";
import { uuid } from "./runtime";

/** Hard restrictions always apply; preference groups rotate daily without excluding other eligible meals from swaps. */
export function mealSuggestions(templates: readonly MealTemplate[], profile: Profile, day: string, mealType: MealType): MealTemplate[] {
  const validDay = addDays(day, 0);
  const offset = Math.floor(new Date(`${validDay}T00:00:00Z`).getTime() / 86400000) + [...profile.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const groups = new Map<number, MealTemplate[]>();
  for (const template of filterTemplates(templates, profile, mealType)) {
    const score = profile.preferences.filter(preference => template.tags.includes(preference)).length;
    groups.set(score, [...(groups.get(score) || []), template]);
  }
  return [...groups.keys()].sort((a, b) => b - a).flatMap(score => {
    const group = groups.get(score)!.sort((a, b) => a.id.localeCompare(b.id));
    const start = ((offset % group.length) + group.length) % group.length;
    return [...group.slice(start), ...group.slice(0, start)];
  });
}

/** Preserve preparation/weight notes; recipe quantities do not imply a match to a GI research sample. */
export function templateMealItems(template: MealTemplate): MealItem[] {
  return template.ingredients.filter(ingredient => ingredient.name !== "饮用水").map(ingredient => {
    const match = ingredient.amount.match(/(\d+(?:\.\d+)?)\s*(克|毫升|个)/);
    if (!match || !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0 || /\d\s*[-–—~～至]\s*\d/.test(ingredient.amount)) return { id: uuid(), foodId: null, name: ingredient.name, quantity: 1, unit: `份（${ingredient.amount}）`, grams: null };
    const before = ingredient.amount.slice(0, match.index).trim().replace(/[，；,;]+$/, "");
    const after = ingredient.amount.slice(match.index! + match[0].length).trim().replace(/^[，；,;]+/, "");
    const context = [before, after].filter(Boolean).join("，");
    return { id: uuid(), foodId: null, name: `${ingredient.name}${context ? `（${context}）` : ""}`, quantity: Number(match[1]), unit: match[2], grams: match[2] === "克" ? Number(match[1]) : null };
  });
}
