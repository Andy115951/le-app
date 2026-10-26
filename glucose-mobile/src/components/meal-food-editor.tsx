import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react-native";
import { FOODS } from "../data/foods";
import type { MealItem } from "../core/domain";
import { Action, colors, Field, styles } from "./ui";

function portionText(item: Pick<MealItem, "quantity" | "unit">) {
  return Number.isFinite(item.quantity) && item.quantity > 0 && item.unit.trim() ? `${item.quantity} ${item.unit}` : "请完善份量";
}

function FoodRow({ item, onPatch, onRemove }: { item: MealItem; onPatch: (changes: Partial<MealItem>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(item.quantity));
  function toggle() { if (!open) setQuantity(Number.isFinite(item.quantity) ? String(item.quantity) : ""); setOpen(!open); }
  return <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 8 }}>
    <View style={[styles.row, { flexWrap: "nowrap", gap: 6 }]}>
      <Text style={[styles.text, { flex: 1 }]}>{item.name || "未填写食物名称"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`修改 ${item.name || "食物"} 的份量`} accessibilityState={{ expanded: open }} onPress={toggle} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 44, maxWidth: "48%", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.soft }}>
        <Text style={[styles.text, { fontSize: 14, color: colors.green }]}>{portionText(item)}</Text>{open ? <ChevronUp size={15} color={colors.green} /> : <ChevronDown size={15} color={colors.green} />}
      </Pressable>
      <Action title="" kind="ghost" accessibilityLabel={`移除 ${item.name || "食物"}`} icon={<X size={17} color={colors.muted} />} onPress={onRemove} />
    </View>
    {open && <View style={{ paddingBottom: 4 }}>
      <Field label="食物名称" value={item.name} onChangeText={name => onPatch({ name })} maxLength={200} />
      <View style={[styles.row, { flexWrap: "nowrap" }]}>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="份量" value={quantity} onChangeText={next => { setQuantity(next); onPatch({ quantity: Number(next) }); }} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="单位" value={item.unit} onChangeText={unit => onPatch({ unit })} maxLength={80} /></View>
      </View>
      <View style={[styles.row, { gap: 6 }]}>{[{ title: "半碗", quantity: .5, unit: "碗" }, { title: "1 个", quantity: 1, unit: "个" }, { title: "1 杯", quantity: 1, unit: "杯" }, { title: "100 克", quantity: 100, unit: "克" }].map(portion => <Action key={portion.title} title={portion.title} kind="secondary" onPress={() => { setQuantity(String(portion.quantity)); onPatch({ quantity: portion.quantity, unit: portion.unit }); }} />)}</View>
      <Action title="完成份量编辑" kind="ghost" onPress={() => setOpen(false)} />
    </View>}
  </View>;
}

type Props = {
  items: MealItem[]; query: string; onQueryChange: (query: string) => void;
  searching: boolean; onSearchingChange: (searching: boolean) => void;
  recentItems: MealItem[]; sourceLabel: string; creatingPreset: boolean;
  onAddFood: (foodId: string) => void; onAddCustom: () => void;
  onPatch: (itemId: string, changes: Partial<MealItem>) => void; onRemove: (itemId: string) => void;
};

export function MealFoodEditor({ items, query, onQueryChange, searching, onSearchingChange, recentItems, sourceLabel, creatingPreset, onAddFood, onAddCustom, onPatch, onRemove }: Props) {
  const searchRef = useRef<TextInput>(null);
  const term = query.trim();
  const results = term ? FOODS.filter(food => [food.name, ...food.aliases].some(text => text.includes(term))).slice(0, 5) : [];
  function continueSearch() { onQueryChange(""); searchRef.current?.focus(); }
  return <View style={{ marginTop: 14 }}>
    <View style={styles.between}><Text style={styles.heading}>{creatingPreset ? "组合里有哪些食物" : "这餐吃了什么"}</Text><Text accessibilityLiveRegion="polite" style={[styles.muted, { color: colors.green }]}>已添加 {items.length} 项</Text></View>
    {!!sourceLabel && <Text style={[styles.muted, { marginTop: 7 }]}>已带入：{sourceLabel}。请按当天实际份量调整。</Text>}
    {searching ? <View>
      <View style={{ marginTop: 12, marginBottom: 8 }}><Text style={styles.label}>搜索或输入食物</Text><TextInput ref={searchRef} accessibilityLabel="搜索或输入食物" placeholder="搜食物，或填写自定义名称" placeholderTextColor="#8b998e" value={query} onChangeText={onQueryChange} maxLength={200} style={styles.input} /></View>
      {results.map(food => {
        const previous = recentItems.find(item => item.foodId === food.id && Number.isFinite(item.quantity) && item.quantity > 0 && item.unit.trim());
        return <View key={food.id} style={[styles.row, { flexWrap: "nowrap", gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.text}>{food.name}</Text><Text style={styles.muted}>{previous ? `上次 ${portionText(previous)}` : `示例 ${food.portionGrams || 1} ${food.portionGrams ? "克" : "份"}`} · 可修改</Text></View>
          <Action title="添加" accessibilityLabel={`添加 ${food.name}`} kind="secondary" onPress={() => { onAddFood(food.id); continueSearch(); }} />
        </View>;
      })}
      {!!term && <Action title={results.length ? `自定义添加「${term}」` : `添加「${term}」`} kind="secondary" onPress={() => { onAddCustom(); continueSearch(); }} />}
      {!term && <Text style={[styles.muted, { fontSize: 12 }]}>添加后可继续搜索；目录份量是记录示例，请按实际调整。</Text>}
      {items.length > 0 && !term && <Action title="收起食物搜索" kind="ghost" onPress={() => onSearchingChange(false)} />}
    </View> : <View style={{ marginVertical: 8 }}><Action title="继续添加食物" kind="secondary" icon={<Plus size={17} color={colors.green} />} onPress={() => onSearchingChange(true)} /></View>}
    <View style={{ marginTop: 8 }}>{items.map(item => <FoodRow key={item.id} item={item} onPatch={changes => onPatch(item.id, changes)} onRemove={() => onRemove(item.id)} />)}</View>
    {!items.length && !term && <Text style={[styles.muted, { marginTop: 10 }]}>还没有食物，搜索添加或从上方带入组合。</Text>}
    <Text style={[styles.muted, { fontSize: 12, marginTop: 10 }]}>{term ? "未点添加的食物也会随本次保存。" : "家用份量按填写数量记录，不自动换算克重。"}</Text>
  </View>;
}
