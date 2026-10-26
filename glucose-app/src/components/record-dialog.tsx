"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Droplet, Plus, Trash2, Utensils, X } from "lucide-react";
import { FOODS } from "@/data/foods";
import type { Food, Meal, MealItem, MealTemplate, MealType, Reading, ReadingContext, Unit } from "@/lib/domain";
import { localDateTimeToIso, mealInterval, parseReading } from "@/lib/domain";
import { contexts, mealNames, timeLabel, uuid } from "@/lib/ui-utils";
import { dateKey } from "@/lib/domain";
import { initialRecordTime, suggestMealType } from "@/lib/record-defaults";
import { cloneMealItems, type MealPreset } from "@/lib/meal-presets";
import { useUnsavedChanges } from "./unsaved-changes";
import { useApp } from "./app-provider";
import { MealCombinationTools } from "./meal-combination-tools";

export type EditorState = { kind: "reading" | "meal"; reading?: Reading; meal?: Meal; food?: Food; foodGrams?: number; template?: MealTemplate; selectedDay?: string; readingContext?: ReadingContext; linkedMealId?: string; preset?: MealPreset; createPreset?: boolean };
export function foodItem(food: Food): MealItem {
  return { id: uuid(), foodId: food.id, name: food.name, quantity: food.portionGrams || 1, unit: food.portionGrams ? "克" : "份", grams: food.portionGrams, foodSnapshot: { gi: food.gi, availableCarbsPer100g: food.availableCarbsPer100g, giStatus: food.giStatus } };
}
function templateItems(template: MealTemplate): MealItem[] {
  return template.ingredients.map(ingredient => {
    return { id: uuid(), foodId: ingredient.foodId || null, name: ingredient.name, quantity: 1, unit: `份（${ingredient.amount}）`, grams: null };
  });
}
export function RecordDialog({ state, close }: { state: EditorState; close: () => void }) {
  const app = useApp();
  const guard = useUnsavedChanges();
  const profile = app.activeProfile!;
  const dialog = useRef<HTMLDialogElement>(null);
  const [validation, setValidation] = useState("");
  const [recordId] = useState(() => state.reading?.id || state.meal?.id || uuid());
  const [time, setTime] = useState(() => initialRecordTime({ existingTime: state.reading?.measuredAt || state.meal?.startedAt, selectedDay: state.selectedDay, timezone: profile.timezone }));
  const [note, setNote] = useState(state.reading?.notes || state.meal?.notes || "");
  const [value, setValue] = useState(state.reading?.special || (state.reading?.value != null ? String(state.reading.value) : ""));
  const [unit, setUnit] = useState<Unit>(state.reading?.unit || profile.unit);
  const [context, setContext] = useState<ReadingContext | "">(state.reading?.context || state.readingContext || "");
  const [mealId, setMealId] = useState(state.reading?.mealId || state.linkedMealId || "");
  const [minutes, setMinutes] = useState(state.reading?.postMealMinutes?.toString() || "");
  const [mealType, setMealType] = useState<MealType>(() => state.meal?.type || state.preset?.mealType || state.template?.mealTypes[0] || suggestMealType(time));
  const [mealTypeChosen, setMealTypeChosen] = useState(!!(state.meal || state.preset || state.template));
  const [templateId, setTemplateId] = useState(state.template?.id || state.meal?.templateId || null);
  const [items, setItems] = useState<MealItem[]>(() => state.meal ? structuredClone(state.meal.items) : state.preset ? cloneMealItems(state.preset.items) : state.food ? [{ ...foodItem(state.food), ...(state.foodGrams ? { quantity: state.foodGrams, grams: state.foodGrams, unit: "克" } : {}) }] : state.template ? templateItems(state.template) : []);
  const [newFood, setNewFood] = useState("");
  const [presetName, setPresetName] = useState("");
  const [timeVerified, setTimeVerified] = useState(!!(state.reading || state.meal));
  function fingerprint(name = presetName) {
    return JSON.stringify(state.kind === "reading"
      ? [time, note, value, unit, context, mealId, minutes]
      : [mealType, state.createPreset ? null : time, state.createPreset ? null : note,
        items.map(({ id: _id, ...item }) => item), newFood, name, templateId]);
  }
  const [savedFingerprint, setSavedFingerprint] = useState(() => {
    const providedNewMeal = !state.createPreset && (state.food || state.template || state.preset || (state.meal && !app.meals.some(meal => meal.id === state.meal!.id)));
    return providedNewMeal ? "" : fingerprint();
  });
  const dirty = fingerprint() !== savedFingerprint;
  useEffect(() => {
    guard.register({ dirty, saving: app.busy, discard: close });
    return () => guard.register(null);
  }, [dirty, app.busy, close, guard.register]);
  const requestClose = () => guard.leave(() => {});
  const linkedMeal = app.meals.find(meal => meal.id === mealId && meal.profileId === profile.id);
  const mealOptions = [...app.meals].filter(meal => meal.profileId === profile.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 60);
  if (linkedMeal && !mealOptions.some(meal => meal.id === linkedMeal.id)) mealOptions.unshift(linkedMeal);
  const backfill = time.slice(0, 10) < dateKey(new Date(), profile.timezone);
  let intervalLabel = "";
  if (context === "after-meal" && linkedMeal && time) {
    try { intervalLabel = `本次为餐后 ${mealInterval(localDateTimeToIso(time, profile.timezone), linkedMeal.startedAt).minutes} 分钟，按实际时间计算。`; }
    catch (error) { intervalLabel = error instanceof Error ? error.message : "请核对实际测量时间。"; }
  }
  useEffect(() => {
    const node = dialog.current; node?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  const patchItem = (id: string, field: "name" | "quantity" | "unit", value: string) => setItems(items.map(item => {
    if (item.id !== id) return item;
    const next = { ...item, [field]: field === "quantity" ? Number(value) : value };
    if (field === "name") { next.foodId = null; next.foodSnapshot = undefined; }
    next.grams = /^(克|g)$/i.test(next.unit) ? next.quantity : null;
    return next;
  }));
  function addFood() {
    const name = newFood.trim(); if (!name) return;
    const food = FOODS.find(food => food.name === name);
    setItems([...items, food ? foodItem(food) : { id: uuid(), foodId: null, name, quantity: 1, unit: "份", grams: null }]); setNewFood("");
  }
  function changeTime(next: string) {
    setTime(next);
    try { localDateTimeToIso(next, profile.timezone); setTimeVerified(true); } catch { setTimeVerified(false); }
    if (!mealTypeChosen && next) { try { setMealType(suggestMealType(next)); } catch { /* Incomplete native input. */ } }
  }
  function collectItems() {
    const fullItems = [...items];
    if (newFood.trim()) {
      const food = FOODS.find(food => food.name === newFood.trim());
      fullItems.push(food ? foodItem(food) : { id: uuid(), foodId: null, name: newFood.trim(), quantity: 1, unit: "份", grams: null });
    }
    if (!fullItems.length) throw new Error("请至少添加一种食物，也可以直接填写你吃的东西。");
    if (fullItems.some(item => !item.name.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !item.unit.trim())) throw new Error("请补全食物名称、有效份量和单位。");
    return fullItems.map(item => ({ ...item, name: item.name.trim(), unit: item.unit.trim() }));
  }
  function useCombination(source: MealPreset | Meal) {
    setItems(cloneMealItems(source.items)); setNewFood(""); setValidation("");
    setMealType("mealType" in source ? source.mealType : source.type); setMealTypeChosen(true);
    setTemplateId("templateId" in source ? source.templateId : null);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setValidation(""); app.clearMessages();
    if (app.busy || state.createPreset) return;
    try {
      const timestamp = localDateTimeToIso(time, profile.timezone);
      if (backfill && !timeVerified) throw new Error("请修改为实际时间，或勾选确认已经核对实际时间。");
      if (!timestamp || Number.isNaN(Date.parse(timestamp))) throw new Error("请填写有效的日期和时间。");
      let ok: boolean;
      if (state.kind === "reading") {
        if (!context) throw new Error("请先选择这次测量的场景。");
        const parsed = parseReading(value, unit);
        const { value: numeric, special, standardValue } = parsed;
        if (standardValue !== null && (standardValue < 1 || standardValue > 35) && !window.confirm(`读数为 ${value} ${unit}，请确认单位及仪器显示无误。仍要保存吗？`)) return;
        const linked = app.meals.find(meal => meal.id === mealId);
        if (mealId && !linked) throw new Error("关联的餐饮记录已变化，请重新选择。");
        if (context === "after-meal" && !linked && minutes && (!/^\d+$/.test(minutes) || Number(minutes) > 1440)) throw new Error("餐后间隔请填写 0–1440 之间的整分钟。");
        const interval = context === "after-meal" ? mealInterval(timestamp, linked?.startedAt || null, !linked && minutes ? Number(minutes) : null) : { minutes: null, source: "unknown" as const };
        if (!linked && context === state.reading?.context && minutes === state.reading?.postMealMinutes?.toString() && state.reading.intervalSource === "calculated") interval.source = "calculated";
        ok = await app.saveReading({ id: recordId, profileId: profile.id, value: numeric, unit, standardValue, special, measuredAt: timestamp, context, mealId: mealId || null, postMealMinutes: interval.minutes, intervalSource: interval.source, notes: note.trim() });
      } else {
        ok = await app.saveMeal({ id: recordId, profileId: profile.id, type: mealType, startedAt: timestamp, notes: note.trim(), templateId, items: collectItems() });
      }
      if (ok) close(); else setValidation("还没有保存成功。请检查提示后重试，表单会保留。");
    } catch (error) { setValidation(error instanceof Error ? error.message : "请核对填写内容。"); }
  }
  return <dialog ref={dialog} className="record-dialog" onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget) requestClose(); }} aria-labelledby="record-title">
    <form onSubmit={submit} className="dialog-inner">
      <div className="dialog-heading"><div className="dialog-icon">{state.kind === "reading" ? <Droplet size={23} /> : <Utensils size={23} />}</div><div><h2 id="record-title">{state.createPreset ? "创建常吃组合" : <>{state.reading || state.meal ? "修改" : "记一笔"}{state.kind === "reading" ? "血糖" : "饮食"}</>}</h2><p>正在为 <strong>{profile.name}</strong> 记录{app.mode === "demo" ? " · 演示体验" : ""}</p></div><button type="button" className="icon-button" onClick={requestClose} disabled={app.busy} aria-label="关闭记录窗口"><X size={20} /></button></div>
      <div className="dialog-body">
        {backfill && !state.createPreset && <div className="backfill-note"><strong>补记 {time.slice(0, 10)}</strong><span>请把下方时间改为实际{state.kind === "reading" ? "测量" : "用餐"}时间。</span><label className="time-confirmation"><input type="checkbox" checked={timeVerified} onChange={event => setTimeVerified(event.target.checked)} />已核对实际时间</label></div>}
        {state.kind === "reading" ? <>
          <div className="value-input"><label htmlFor="reading-value">仪器读数</label><div><input autoFocus id="reading-value" name="reading-value" type="text" inputMode="decimal" required placeholder="0.0" value={value} onChange={e => setValue(e.target.value)} /><select aria-label="血糖输入单位" value={unit} onChange={e => setUnit(e.target.value as Unit)}><option>mmol/L</option><option>mg/dL</option></select></div><small>按仪器显示填写；超出量程可填 HI 或 LO。</small></div>
          <fieldset className="unstyled-fieldset"><legend>测量场景 <span className="muted">{!context && "请选择"}</span></legend><div className="segmented wrap">{Object.entries(contexts).map(([key, label]) => <button type="button" aria-pressed={context === key} className={context === key ? "selected" : ""} key={key} onClick={() => setContext(key as ReadingContext)}>{label}</button>)}</div></fieldset>
        </> : <fieldset className="unstyled-fieldset"><legend>记录哪一餐</legend><div className="segmented">{Object.entries(mealNames).map(([key, label]) => <button type="button" aria-pressed={mealType === key} className={mealType === key ? "selected" : ""} key={key} onClick={() => { setMealType(key as MealType); setMealTypeChosen(true); }}>{label}</button>)}</div>{!mealTypeChosen && <small className="muted">已按填写时间预选，可手动修改餐次。</small>}</fieldset>}
        {!state.createPreset && <label className="field">{state.kind === "reading" ? "实际测量时间" : "用餐开始时间"}<input required type="datetime-local" value={time} onChange={e => changeTime(e.target.value)} /><small>时区：{profile.timezone} · 支持补记</small></label>}
        {state.kind === "reading" ? <>
          <label className="field">关联一餐（可选）<select value={mealId} onChange={e => setMealId(e.target.value)}><option value="">暂不关联</option>{mealOptions.map(meal => <option key={meal.id} value={meal.id}>{new Intl.DateTimeFormat("zh-CN", { timeZone: profile.timezone, month: "numeric", day: "numeric" }).format(new Date(meal.startedAt))} {timeLabel(meal.startedAt, profile.timezone)} {mealNames[meal.type]} · {meal.items.map(i => i.name).join("、")}</option>)}</select></label>
          {linkedMeal && <div className="linked-meal-note"><strong>{mealNames[linkedMeal.type]} · {timeLabel(linkedMeal.startedAt, profile.timezone)} 开始</strong><span>{linkedMeal.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join("、")}</span></div>}
          {context === "after-meal" && (linkedMeal ? <p className="inline-note" role="status">{intervalLabel}</p> : <label className="field">餐后实际间隔（分钟，可选）<input inputMode="numeric" type="number" min="0" max="1440" step="1" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="例如 120；不确定可留空" /></label>)}
        </> : <>
          <MealCombinationTools mealType={mealType} collectItems={collectItems} onSelect={useCombination} empty={!items.length && !newFood} creating={state.createPreset} name={presetName} onNameChange={setPresetName} onSaved={() => { if (state.createPreset) setSavedFingerprint(fingerprint("")); }}>
          <fieldset className="unstyled-fieldset"><legend>这餐吃了什么</legend><div className="meal-item-list">{items.map(item => <div className="meal-item-block" key={item.id}><div className="meal-item-editor"><input aria-label="食物名称" value={item.name} onChange={e => patchItem(item.id, "name", e.target.value)} required /><input aria-label={`${item.name}份量`} type="number" min="0.1" step="any" value={item.quantity || ""} onChange={e => patchItem(item.id, "quantity", e.target.value)} required /><input aria-label={`${item.name}单位`} value={item.unit} onChange={e => patchItem(item.id, "unit", e.target.value)} required /><button type="button" className="icon-button" aria-label={`移除${item.name}`} onClick={() => setItems(items.filter(i => i.id !== item.id))}><Trash2 size={16} /></button></div><div className="portion-shortcuts" aria-label={`${item.name}快捷份量`}>{[{ label: "半碗", quantity: 0.5, unit: "碗" }, { label: "1 碗", quantity: 1, unit: "碗" }, { label: "1 个", quantity: 1, unit: "个" }, { label: "1 杯", quantity: 1, unit: "杯" }, { label: "50 克", quantity: 50, unit: "克" }, { label: "100 克", quantity: 100, unit: "克" }].map(portion => <button type="button" key={portion.label} onClick={() => setItems(current => current.map(other => other.id === item.id ? { ...other, quantity: portion.quantity, unit: portion.unit, grams: portion.unit === "克" ? portion.quantity : null } : other))}>{portion.label}</button>)}</div></div>)}</div><div className="add-food-row"><input autoFocus list="food-options" aria-label="搜索或输入食物" placeholder="搜食物，或直接写今天吃了什么" value={newFood} onChange={e => setNewFood(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFood(); } }} /><button type="button" className="button secondary compact" onClick={addFood}><Plus size={17} />添加</button></div><datalist id="food-options">{FOODS.map(food => <option key={food.id} value={food.name} />)}</datalist><small className="muted">半碗可填 0.5 碗。只有填写克数时才按重量记录，不猜测家用份量的营养值。</small></fieldset>
          </MealCombinationTools>
        </>}
        {!state.createPreset && <label className="field">备注（可选）<textarea rows={2} maxLength={2000} placeholder={state.kind === "reading" ? "比如运动、睡眠或当时的感受" : "比如做法、调味，或这餐的小感受"} value={note} onChange={e => setNote(e.target.value)} /></label>}
        {(validation || app.error) && <div className="form-error" role="alert">{app.error || validation}</div>}
      </div>
      <div className="dialog-footer"><button type="button" className="button secondary" disabled={app.busy} onClick={requestClose}>{state.createPreset ? "关闭" : "取消"}</button>{!state.createPreset && <button className="button primary" disabled={app.busy}><Check size={17} />{app.busy ? "正在保存…" : app.mode === "demo" ? "保存到本次演示" : "保存记录"}</button>}</div>
    </form>
  </dialog>;
}
