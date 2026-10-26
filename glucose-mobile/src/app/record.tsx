import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FOODS } from "../data/foods";
import { dateKey, filterTemplates, localDateTimeToIso, mealInterval, parseReading, type Meal, type MealItem, type MealTemplate, type MealType, type Reading, type ReadingContext, type Unit } from "../core/domain";
import { initialRecordTime, suggestMealType } from "../core/record-defaults";
import { cloneMealItems, type MealPreset } from "../core/meal-presets";
import { contexts, mealNames, mealSummary, timeLabel } from "../core/format";
import { cloneData, uuid } from "../core/runtime";
import { useApp } from "../state/app-provider";
import { Access, Action, Card, Chips, Disclosure, Field, Page, Select, styles } from "../components/ui";
import { DateTimeField } from "../components/date-time";
import { useDraftGuard } from "../components/draft-guard";
import { useConfirm } from "../components/confirmation";
import { MealFoodEditor } from "../components/meal-food-editor";
import { MEAL_TEMPLATES } from "../data/meal-templates";
import { templateMealItems } from "../core/meal-suggestions";
import { parseMealSwaps, resolveMealSwaps } from "../core/meal-substitutions";
type Params = { kind?: string; id?: string; day?: string; mealId?: string; context?: string; presetId?: string; foodId?: string; grams?: string; createPreset?: string; templateId?: string; mealType?: string; suggestedFor?: string; swaps?: string };
function foodItem(foodId: string, grams?: number): MealItem {
  const food = FOODS.find(item => item.id === foodId)!;
  const quantity = grams || food.portionGrams || 1;
  return { id: uuid(), foodId, name: food.name, quantity, unit: grams || food.portionGrams ? "克" : "份", grams: grams || food.portionGrams || null, foodSnapshot: { gi: food.gi, giStatus: food.giStatus, availableCarbsPer100g: food.availableCarbsPer100g } };
}
export default function RecordPage() {
  const params = useLocalSearchParams<Params>(); const app = useApp();
  const reading = params.kind === "reading" && params.id ? app.readings.find(item => item.id === params.id) : undefined;
  const meal = params.kind === "meal" && params.id ? app.meals.find(item => item.id === params.id) : undefined;
  const preset = params.presetId ? app.mealPresets.find(item => item.id === params.presetId) : undefined;
  let template = params.kind === "meal" && params.templateId ? MEAL_TEMPLATES.find(item => item.id === params.templateId) : undefined;
  let invalidSwap = false;
  if (template && app.activeProfile) {
    try { template = resolveMealSwaps(template, parseMealSwaps(params.swaps), app.activeProfile); }
    catch { invalidSwap = true; }
  }
  if (app.activeProfile && app.recordsReady && params.templateId && (!template || invalidSwap || (params.suggestedFor && params.suggestedFor !== app.activeProfile.id) || !filterTemplates([template], app.activeProfile).length)) return <Page title="搭配条件已变化" back members={false}><Text style={styles.text}>这份搭配不再符合当前成员的条件，请返回“吃什么”重新选择。</Text></Page>;
  if (app.activeProfile && app.recordsReady && ((params.id && !reading && !meal) || (params.presetId && !preset) || (params.mealId && !app.meals.some(item => item.id === params.mealId)))) return <Page title="记录已变化" back members={false}><Text style={styles.text}>这条记录不属于当前成员，或已被删除，请返回刷新后重试。</Text></Page>;
  return <Access>{app.activeProfile && <RecordForm key={`${app.activeProfile.id}-${params.templateId || params.presetId || params.id || "new"}-${params.swaps || ""}`} params={params} reading={reading} meal={meal} preset={preset} template={template} />}</Access>;
}
function RecordForm({ params, reading, meal, preset, template }: { params: Params; reading?: Reading; meal?: Meal; preset?: MealPreset; template?: MealTemplate }) {
  const app = useApp(); const profile = app.activeProfile!; const router = useRouter(); const ask = useConfirm();
  const kind = params.kind === "meal" ? "meal" : "reading"; const creatingPreset = params.createPreset === "1" && kind === "meal";
  const [id] = useState(() => reading?.id || meal?.id || uuid()); const [presetId, setPresetId] = useState(uuid);
  const [time, setTime] = useState(() => initialRecordTime({ existingTime: reading?.measuredAt || meal?.startedAt, selectedDay: params.day, timezone: profile.timezone }));
  const [value, setValue] = useState(reading?.special || reading?.value?.toString() || ""); const [unit, setUnit] = useState<Unit>(reading?.unit || profile.unit);
  const [context, setContext] = useState<ReadingContext | "">(reading?.context || (params.context && params.context in contexts ? params.context as ReadingContext : ""));
  const [linkedId, setLinkedId] = useState(reading?.mealId || params.mealId || ""); const [minutes, setMinutes] = useState(reading?.postMealMinutes?.toString() || "");
  const [mealType, setMealType] = useState<MealType>(meal?.type || preset?.mealType || (template ? template.mealTypes.find(type => type === params.mealType) || template.mealTypes[0] : params.mealType && Object.keys(mealNames).includes(params.mealType) ? params.mealType as MealType : suggestMealType(time)));
  const [items, setItems] = useState<MealItem[]>(() => meal ? cloneData(meal.items) : preset ? cloneMealItems(preset.items) : template ? templateMealItems(template) : params.foodId && FOODS.some(food => food.id === params.foodId) ? [foodItem(params.foodId, +params.grams! > 0 ? +params.grams! : undefined)] : []);
  const [templateId, setTemplateId] = useState(meal?.templateId || template?.id || null);
  const [newFood, setNewFood] = useState(""); const [name, setName] = useState(""); const [note, setNote] = useState(reading?.notes || meal?.notes || "");
  const [verified, setVerified] = useState(!!reading || !!meal); const [error, setError] = useState(""); const [done, setDone] = useState(false); const [shortcuts, setShortcuts] = useState(false); const submitting = useRef(false);
  const [linkExpanded, setLinkExpanded] = useState(Boolean(reading?.mealId || params.mealId || reading?.context === "after-meal" || params.context === "after-meal"));
  const [searching, setSearching] = useState(!meal && !preset && !template && !params.foodId);
  const [sourceLabel, setSourceLabel] = useState(preset?.name || template?.name || "");
  const fingerprint = (presetName = name) => JSON.stringify(kind === "reading" ? [time, value, unit, context, linkedId, minutes, note] : [creatingPreset ? null : time, mealType, items, newFood, creatingPreset ? null : note, presetName, templateId]);
  const [baseline] = useState(() => !creatingPreset && (preset || template || params.foodId) ? "" : fingerprint());
  useDraftGuard(!done && fingerprint() !== baseline, !done && app.busy);
  useEffect(() => { if (done) { if (router.canGoBack()) router.back(); else router.replace("/"); } }, [done, router]);
  const backfill = time.slice(0, 10) < dateKey(new Date(), profile.timezone);
  const linked = app.meals.find(item => item.id === linkedId && item.profileId === profile.id);
  const recentMeals = [...app.meals].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const recentItems = recentMeals.flatMap(item => item.items);
  function catalogItem(foodId: string) {
    const item = foodItem(foodId);
    const previous = recentItems.find(entry => entry.foodId === foodId && Number.isFinite(entry.quantity) && entry.quantity > 0 && entry.unit.trim());
    return previous ? { ...item, quantity: previous.quantity, unit: previous.unit, grams: previous.grams } : item;
  }
  function typedItem(): MealItem {
    const food = FOODS.find(item => item.name === newFood.trim());
    return food ? catalogItem(food.id) : { id: uuid(), foodId: null, name: newFood.trim(), quantity: 1, unit: "份", grams: null };
  }
  function collect() {
    const next = newFood.trim() ? [...items, typedItem()] : items;
    if (!next.length || next.some(item => !item.name.trim() || !item.unit.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0)) throw new Error("请至少填写一种食物，并补全有效名称、份量和单位。");
    return next.map(item => ({ ...item, name: item.name.trim(), unit: item.unit.trim() }));
  }
  function patchItem(itemId: string, changes: Partial<MealItem>) {
    setItems(current => current.map(item => {
      if (item.id !== itemId) return item;
      const next = { ...item, ...changes };
      if (changes.name !== undefined && changes.name !== item.name) { next.foodId = null; next.foodSnapshot = undefined; }
      if (changes.unit !== undefined || changes.quantity !== undefined) next.grams = /^(克|g)$/i.test(next.unit) ? next.quantity : null;
      return next;
    }));
  }
  async function choose(source: Meal | MealPreset) {
    if ((items.length || newFood.trim()) && !await ask({ title: "替换当前食物？", message: "带入后会替换下方食物和份量，请按实际用餐调整。", confirmText: "替换食物" })) return;
    setItems(cloneMealItems(source.items)); setNewFood(""); setMealType("mealType" in source ? source.mealType : source.type); setShortcuts(false); setSearching(false);
    setSourceLabel("mealType" in source ? source.name : `${timeLabel(source.startedAt, profile.timezone, true)} ${mealNames[source.type]}`); setError("");
    setTemplateId("mealType" in source ? null : source.templateId);
  }
  async function save(asPreset = false) {
    if (submitting.current || app.busy) return;
    submitting.current = true; setError(""); app.clearMessages();
    try {
      if (asPreset) {
        const ok = await app.saveMealPreset({ id: presetId, profileId: profile.id, name, mealType, items: collect() });
        if (ok) { if (creatingPreset) setDone(true); else { setName(""); setPresetId(uuid()); } }
        return;
      }
      if (backfill && !verified) throw new Error("请核对实际日期和时间，再勾选时间确认。");
      const timestamp = localDateTimeToIso(time, profile.timezone);
      let ok: boolean;
      if (kind === "reading") {
        if (!context) throw new Error("请先选择这次测量的场景。");
        const parsed = parseReading(value, unit);
        if (parsed.standardValue !== null && (parsed.standardValue < 1 || parsed.standardValue > 35) && !await ask({ title: "请核对仪器读数", message: `本次填写 ${value} ${unit}，确认单位和仪器显示无误后再保存。`, confirmText: "确认保存" })) return;
        if (linkedId && !linked) throw new Error("关联的餐食已变化，请重新选择。");
        if (!linked && context === "after-meal" && minutes && (!/^\d+$/.test(minutes) || +minutes > 1440)) throw new Error("餐后间隔请填写 0–1440 的整分钟，或留空。");
        const interval = context === "after-meal" ? mealInterval(timestamp, linked?.startedAt || null, !linked && minutes ? +minutes : null) : { minutes: null, source: "unknown" as const };
        if (!linked && reading?.intervalSource === "calculated" && context === reading.context && minutes === reading.postMealMinutes?.toString()) interval.source = "calculated";
        ok = await app.saveReading({ id, profileId: profile.id, ...parsed, context, measuredAt: timestamp, mealId: linkedId || null, postMealMinutes: interval.minutes, intervalSource: interval.source, notes: note.trim() });
      } else ok = await app.saveMeal({ id, profileId: profile.id, type: mealType, startedAt: timestamp, notes: note.trim(), templateId, items: collect() });
      if (ok) setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存未完成，请保留输入重试。"); }
    finally { submitting.current = false; }
  }
  async function remove() {
    if (!await ask({ title: "删除这笔记录？", message: kind === "meal" ? "餐食删除后无法撤销，关联血糖会保留并解除关联。" : "这笔血糖记录删除后无法撤销。", confirmText: "删除记录" })) return;
    const ok = kind === "reading" ? await app.deleteReading(id) : await app.deleteMeal(id);
    if (ok) setDone(true);
  }
  let interval = "";
  if (kind === "reading" && context === "after-meal" && linked) {
    try { interval = `按实际时间计算：餐后 ${mealInterval(localDateTimeToIso(time, profile.timezone), linked.startedAt).minutes} 分钟`; }
    catch { interval = "测量时间早于用餐，请核对时间。"; }
  }
  const footer = <View>
    {(error || app.error) && <Text accessibilityRole="alert" style={{ color: "#a33d3d", fontSize: 13, lineHeight: 20, marginBottom: 8 }}>{error || app.error}</Text>}
    <View style={[styles.row, { flexWrap: "nowrap" }]}>
      <View style={{ flex: 1 }}><Action title={creatingPreset ? "关闭" : "取消"} kind="ghost" disabled={app.busy} onPress={() => router.canGoBack() ? router.back() : router.replace("/")} /></View>
      <View style={{ flex: 3 }}><Action title={app.busy ? "正在保存…" : creatingPreset ? "保存组合" : app.mode === "demo" ? "保存到本次演示" : "保存到云端"} disabled={app.busy} onPress={() => void save(creatingPreset)} /></View>
    </View>
  </View>;
  return <Page title={creatingPreset ? "创建常吃组合" : `${reading || meal ? "修改" : "记一笔"}${kind === "reading" ? "血糖" : "饮食"}`} back dense members={false} refresh={false} headerNote={`为 ${profile.name} 记录`} hideError footer={footer}>
    <View pointerEvents={app.busy ? "none" : "auto"}><Card>
      {creatingPreset && <Field label="组合名称（必填）" value={name} onChangeText={setName} maxLength={60} placeholder="比如：工作日早餐" />}
      {kind === "reading" ? <>
        <Field label="仪器读数" value={value} onChangeText={setValue} autoCapitalize="characters" placeholder="5.8 / HI / LO" style={{ fontSize: 28, lineHeight: 36, minHeight: 64 }} />
        <Chips value={unit} onChange={setUnit} options={[{ value: "mmol/L", label: "mmol/L" }, { value: "mg/dL", label: "mg/dL" }]} />
        <Text style={[styles.label, { marginTop: 14 }]}>测量场景（必选）</Text>
        <Chips value={context} onChange={next => { setContext(next); if (next === "after-meal") setLinkExpanded(true); }} options={Object.entries(contexts).map(([value, label]) => ({ value: value as ReadingContext, label }))} />
      </> : <><Text style={styles.label}>记录哪一餐</Text><Chips value={mealType} onChange={setMealType} options={Object.entries(mealNames).map(([value, label]) => ({ value: value as MealType, label }))} /></>}
      {!creatingPreset && <><DateTimeField label={kind === "reading" ? "实际测量时间" : "用餐开始时间"} value={time} onChange={next => { setTime(next); setVerified(true); }} /><Text style={[styles.muted, { fontSize: 12 }]}>成员时区：{profile.timezone}</Text>{backfill && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: verified }} onPress={() => setVerified(!verified)} style={{ paddingVertical: 12 }}><Text style={styles.text}>{verified ? "☑" : "☐"} 已核对补记的实际时间</Text></Pressable>}</>}
      {kind === "reading" ? <>
        <Action title={linkExpanded ? "收起餐食关联" : "关联餐食 / 餐后间隔（可选）"} kind="ghost" onPress={() => setLinkExpanded(!linkExpanded)} />
        {linkExpanded && <><Select label="关联一餐（可选）" value={linkedId} onChange={setLinkedId} options={[{ value: "", label: "暂不关联" }, ...[...app.meals].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(item => ({ value: item.id, label: `${timeLabel(item.startedAt, profile.timezone, true)} ${mealNames[item.type]} · ${item.items.map(food => food.name).join("、")}` }))]} />{linked && <Text style={styles.muted}>{mealSummary(linked)}</Text>}{context === "after-meal" && (linked ? <Text style={styles.muted}>{interval}</Text> : <Field label="餐后间隔（分钟，可选）" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="不确定可留空" />)}</>}
      </> : <>
        {(app.mealPresets.length > 0 || recentMeals.length > 0) && <Action title={shortcuts ? "收起常吃组合与最近用餐" : "从常吃组合或最近用餐带入"} kind="ghost" onPress={() => setShortcuts(!shortcuts)} />}
        {shortcuts && <View style={{ gap: 8, marginVertical: 8 }}>
          {app.mealPresets.length > 0 && <Text style={styles.label}>常吃组合</Text>}
          {app.mealPresets.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`带入组合 ${item.name}`} onPress={() => void choose(item)} style={{ borderWidth: 1, borderColor: "#e2e9df", borderRadius: 12, padding: 12, minHeight: 44 }}><Text style={styles.text}>{item.name} · {item.items.length} 项</Text><Text numberOfLines={2} style={styles.muted}>{item.items.map(food => `${food.name} ${food.quantity}${food.unit}`).join(" · ")}</Text></Pressable>)}
          {recentMeals.length > 0 && <Text style={[styles.label, { marginTop: 8 }]}>最近用餐</Text>}
          {recentMeals.slice(0, 3).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`带入用餐 ${timeLabel(item.startedAt, profile.timezone, true)} ${mealNames[item.type]}`} onPress={() => void choose(item)} style={{ borderWidth: 1, borderColor: "#e2e9df", borderRadius: 12, padding: 12, minHeight: 44 }}><Text style={styles.text}>{timeLabel(item.startedAt, profile.timezone, true)} {mealNames[item.type]} · {item.items.length} 项</Text><Text numberOfLines={2} style={styles.muted}>{item.items.map(food => `${food.name} ${food.quantity}${food.unit}`).join(" · ")}</Text></Pressable>)}
        </View>}
        <MealFoodEditor items={items} query={newFood} onQueryChange={setNewFood} searching={searching} onSearchingChange={setSearching} recentItems={recentItems} sourceLabel={sourceLabel} creatingPreset={creatingPreset}
          onAddFood={foodId => { setItems(current => [...current, catalogItem(foodId)]); setError(""); }}
          onAddCustom={() => { if (newFood.trim()) { const item = typedItem(); setItems(current => [...current, item]); setError(""); } }}
          onPatch={patchItem} onRemove={itemId => { setItems(current => current.filter(item => item.id !== itemId)); if (items.length === 1) setSearching(true); }} />
        {!creatingPreset && <Disclosure title="另存为常吃组合（可选）"><Field label="组合名称" value={name} onChangeText={setName} maxLength={60} placeholder="比如：工作日早餐" /><Action title="保存组合" kind="secondary" disabled={app.busy} onPress={() => void save(true)} /><Text style={styles.muted}>只保存组合，不会新增用餐记录。这餐仍需单独保存。</Text></Disclosure>}
      </>}
      {!creatingPreset && <Disclosure title="备注（可选）" defaultOpen={!!note}><Field label="备注内容" value={note} onChangeText={setNote} multiline maxLength={2000} placeholder="记下做法、运动或当时的感受" /></Disclosure>}
      {(reading || meal) && <Disclosure title="更多操作"><Action title="删除这笔记录" kind="danger" disabled={app.busy} onPress={() => void remove()} /></Disclosure>}
    </Card></View>
  </Page>;
}
