"use client";
import { Heart, Plus } from "lucide-react";
import { MEAL_TEMPLATES } from "@/data/meal-templates";
import { filterTemplates } from "@/lib/domain";
import { useApp } from "./app-provider";
import { useEditor } from "./app-shell";

export function SavedRecipes() {
  const app = useApp(); const open = useEditor();
  if (!app.activeProfile) return null;
  const templates = MEAL_TEMPLATES.filter(template => app.favorites.includes(`template:${template.id}`));
  return <section className="saved-recipes card padded">
    <div className="section-heading"><h2><Heart size={17} />收藏的搭配</h2><span className="muted">常吃的，就留在这里</span></div>
    {templates.length ? <div className="saved-recipe-grid">{templates.map(template => {
      const allowed = filterTemplates([template], app.activeProfile!).length > 0;
      return <div className="saved-recipe" key={template.id}>
        <div><h3>{template.name}</h3><p>{template.ingredients.map(ingredient => `${ingredient.name} ${ingredient.amount}`).join(" · ")}</p>{!allowed && <small>与当前过敏、忌口或偏好限制不匹配，请核对后再选用。</small>}</div>
        <button className="button secondary compact" disabled={!allowed} onClick={() => open({ kind: "meal", template })}><Plus size={15} />记这餐</button>
        <button className="icon-button hearted" aria-label={`取消收藏${template.name}`} onClick={() => void app.toggleFavorite("template", template.id)}><Heart size={16} fill="currentColor" /></button>
      </div>;
    })}</div> : <p className="muted">点搭配卡片上的爱心，把喜欢的早餐、午餐和晚餐留在这里。</p>}
  </section>;
}
