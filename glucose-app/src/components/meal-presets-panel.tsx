"use client";

import { Bookmark, Plus, Trash2, Utensils } from "lucide-react";
import { mealNames } from "@/lib/ui-utils";
import { useApp } from "./app-provider";
import { useEditor } from "./app-shell";

export function MealPresetsPanel({ selectedDay }: { selectedDay?: string }) {
  const app = useApp();
  const open = useEditor();
  const profile = app.activeProfile;
  if (!profile || !app.recordsReady || (app.mode !== "cloud" && app.mode !== "demo")) return null;
  const presets = app.mealPresets.filter(preset => preset.profileId === profile.id);
  return <section className="meal-presets-panel card padded">
    <div className="section-heading">
      <div><h2><Bookmark size={18} />{profile.name}的常吃组合</h2><p>保存常吃的食物和份量，下次记餐时一键带入，再按实际调整。</p></div>
      <button className="button secondary compact" disabled={app.busy} onClick={() => open({ kind: "meal", selectedDay, createPreset: true })}><Plus size={15} />创建常吃组合</button>
    </div>
    {presets.length ? <div className="meal-presets-grid">{presets.map(preset => <article className="meal-preset-card" key={preset.id}>
      <div className="meal-preset-heading"><span className="badge soft-green">{mealNames[preset.mealType]}</span><h3>{preset.name}</h3></div>
      <p className="meal-preset-items">{preset.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join(" · ")}</p>
      <div className="meal-preset-actions">
        <button className="button secondary compact" disabled={app.busy} onClick={() => open({ kind: "meal", preset, selectedDay })}><Utensils size={15} />记这餐</button>
        <button className="icon-button danger-text" disabled={app.busy} aria-label={`删除常吃组合${preset.name}`} onClick={() => {
          if (window.confirm(`删除常吃组合「${preset.name}」？只会删除这个组合，过去的餐饮记录仍保留。`)) void app.deleteMealPreset(preset.id);
        }}><Trash2 size={16} /></button>
      </div>
    </article>)}</div> : <div className="meal-presets-empty"><Bookmark size={25} /><p>还没有常吃组合。打开记餐表单，填好食物与份量后，选择「保存为常吃组合」。</p></div>}
  </section>;
}
