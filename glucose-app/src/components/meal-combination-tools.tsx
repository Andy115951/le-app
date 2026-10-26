"use client";

import { useRef, useState, type ReactNode } from "react";
import { BookmarkPlus } from "lucide-react";
import type { Meal, MealItem, MealType } from "@/lib/domain";
import { cloneMealItems, type MealPreset } from "@/lib/meal-presets";
import { mealNames, timeLabel, uuid } from "@/lib/ui-utils";
import { useApp } from "./app-provider";

export function MealCombinationTools({ mealType, collectItems, onSelect, empty, creating = false, name, onNameChange, onSaved, children }: {
  mealType: MealType;
  collectItems: () => MealItem[];
  onSelect: (source: MealPreset | Meal) => void;
  empty: boolean;
  creating?: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onSaved: () => void;
  children: ReactNode;
}) {
  const app = useApp();
  const profile = app.activeProfile!;
  const [draftId, setDraftId] = useState(uuid);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);
  const presets = app.mealPresets.filter(preset => preset.profileId === profile.id);
  const recent = [...app.meals].filter(meal => meal.profileId === profile.id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .filter((meal, index, all) => all.findIndex(other => other.type === meal.type && JSON.stringify(other.items.map(item => [item.name, item.quantity, item.unit])) === JSON.stringify(meal.items.map(item => [item.name, item.quantity, item.unit]))) === index)
    .slice(0, 4);

  async function save() {
    if (app.busy || saving.current) return;
    saving.current = true;
    setError(""); setNotice(""); app.clearMessages();
    try {
      const ok = await app.saveMealPreset({ id: draftId, profileId: profile.id, name: name.trim(), mealType, items: cloneMealItems(collectItems()) });
      if (ok) { setNotice(`「${name.trim()}」已保存，下次记餐可直接选用。`); onNameChange(""); onSaved(); setDraftId(uuid()); }
      else setError("组合还未保存成功，填写内容已保留，请重试。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "请核对组合名称与食物份量。"); }
    finally { saving.current = false; }
  }
  function choose(source: MealPreset | Meal) {
    onSelect(source); setError(""); setNotice("");
  }
  return <>
    {(presets.length > 0 || recent.length > 0) && <details className="meal-shortcuts" open={empty}>
      <summary>从常吃组合或最近用餐带入</summary>
      <p>选择后替换下方食物清单，再按这次实际吃的份量调整。</p>
      {presets.length > 0 && <><h3>我的常吃组合</h3><div className="shortcut-list">{presets.map(preset => <button type="button" key={preset.id} disabled={app.busy} onClick={() => choose(preset)}>
        <strong>{preset.name}<small>{mealNames[preset.mealType]}</small></strong><span>{preset.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join("、")}</span>
      </button>)}</div></>}
      {recent.length > 0 && <><h3>最近常吃</h3><div className="shortcut-list">{recent.map(meal => <button type="button" key={meal.id} disabled={app.busy} onClick={() => choose(meal)}>
        <strong>{mealNames[meal.type]}<small>{new Intl.DateTimeFormat("zh-CN", { timeZone: profile.timezone, month: "numeric", day: "numeric" }).format(new Date(meal.startedAt))} {timeLabel(meal.startedAt, profile.timezone)}</small></strong><span>{meal.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join("、")}</span>
      </button>)}</div></>}
    </details>}
    {children}
    <details className="save-combination" open={creating || undefined}>
      <summary><BookmarkPlus size={15} />保存为常吃组合</summary>
      <p>保存当前食物与份量，下次记餐时直接选用。</p>
      <label className="field">组合名称<input maxLength={60} value={name} onChange={event => onNameChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } }} placeholder="例如：工作日早餐" /></label>
      <button type="button" className={`button ${creating ? "primary" : "secondary compact"}`} disabled={app.busy} onClick={() => void save()}><BookmarkPlus size={15} />保存组合</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="inline-note" role="status">{notice}</p>}
    </details>
  </>;
}
