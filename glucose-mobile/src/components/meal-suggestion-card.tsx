import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Clock3, RefreshCw, Sprout } from "lucide-react-native";
import type { MealTemplate, Profile } from "../core/domain";
import { mealSwapChoices, resolveMealSwaps, supportsMealSwap, type MealSwapChoice, type MealSwaps } from "../core/meal-substitutions";
import { ROLE_LABELS, SWAP_FOOD_BY_NAME } from "../data/meal-substitutions";
import { Action, Card, colors, Disclosure, styles } from "./ui";

const seasonings = new Set(["菜籽油", "盐", "饮用水", "鲜姜", "蒜", "葱", "柠檬汁"]);
type Props = { base: MealTemplate; profile: Profile; mealName: string; index: number; total: number; busy: boolean; onNext: () => void; onRecord: (template: MealTemplate, swaps: MealSwaps) => void };

export function MealSuggestionCard({ base, profile, mealName, index, total, busy, onNext, onRecord }: Props) {
  const [swaps, setSwaps] = useState<MealSwaps>({});
  const template = resolveMealSwaps(base, swaps, profile);
  const [picker, setPicker] = useState<{ name: string; role: string; choices: MealSwapChoice[] }>({ name: "", role: "", choices: [] });
  const [pickerVisible, setPickerVisible] = useState(false);
  const changed = Object.keys(swaps).length;
  function openPicker(ingredientIndex: number) {
    const ingredient = template.ingredients[ingredientIndex];
    const role = SWAP_FOOD_BY_NAME.get(ingredient.name)?.role;
    setPicker({ name: ingredient.name, role: role ? ROLE_LABELS[role] : "食物", choices: mealSwapChoices(base, swaps, ingredientIndex, profile) });
    setPickerVisible(true);
  }
  return <>
    <Card>
      <View style={[styles.between, { flexWrap: "nowrap" }]}><View style={styles.row}><Sprout size={18} color={colors.green} /><Text style={[styles.muted, { color: colors.green }]}>{mealName}搭配</Text></View><Action title="换一套" accessibilityLabel={`换一套${mealName}搭配`} kind="ghost" disabled={total <= 1} icon={<RefreshCw size={16} color={colors.green} />} onPress={onNext} /></View>
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: 21, lineHeight: 30, marginTop: 12, marginBottom: 8 }]}>{template.name}</Text>
      <View style={[styles.row, { marginBottom: 12 }]}><Clock3 size={15} color={colors.muted} /><Text style={styles.muted}>约 {template.minutes} 分钟 · 一人份示例 · {index + 1}/{total} 套</Text></View>
      {changed > 0 && <View style={styles.between}><Text accessibilityLiveRegion="polite" style={[styles.muted, { color: colors.green }]}>已替换 {changed} 项</Text><Action title="恢复原搭配" kind="ghost" onPress={() => setSwaps({})} /></View>}
      <Text style={styles.label}>食物与份量</Text>
      {template.ingredients.map((ingredient, ingredientIndex) => ({ ingredient, ingredientIndex })).filter(({ ingredient }) => !seasonings.has(ingredient.name)).map(({ ingredient, ingredientIndex }) => <View key={ingredientIndex} style={[styles.row, { flexWrap: "nowrap", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }]}>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.text, swaps[String(ingredientIndex)] ? { color: colors.green } : undefined]}>{ingredient.name}</Text><Text style={styles.muted}>{ingredient.amount}</Text></View>
        {supportsMealSwap(base.ingredients[ingredientIndex]) && <Action title="换一种" accessibilityLabel={`替换 ${ingredient.name}`} kind="ghost" disabled={busy} onPress={() => openPicker(ingredientIndex)} />}
      </View>)}
      <View style={{ backgroundColor: colors.soft, padding: 12, borderRadius: 12, marginVertical: 12 }}><Text style={[styles.label, { marginBottom: 4 }]}>这样搭配的理由</Text><Text style={styles.muted}>{template.reason}</Text></View>
      <Action title="带入记餐，调整实际份量" disabled={busy} onPress={() => onRecord(template, swaps)} />
      <Text style={[styles.muted, { fontSize: 12, marginTop: 10 }]}>{total === 1 ? "目前只有这一套符合条件。" : ""}确认实际吃过后再保存，份量可调整。</Text>
      <Disclosure title="调味、用水与食材提示">
        {template.ingredients.filter(item => seasonings.has(item.name)).map((ingredient, i) => <Text key={i} style={[styles.muted, { marginBottom: 6 }]}>{ingredient.name} · {ingredient.amount}</Text>)}
        <Text style={[styles.text, { marginTop: 8 }]}>已知过敏原：{template.allergens.join("、") || "未列出常见过敏原"}</Text><Text style={styles.muted}>包装配料和交叉接触需按实际产品核对。</Text>
        {template.swaps.map((swap, i) => <Text key={i} style={[styles.muted, { marginTop: 8 }]}>{swap}</Text>)}
      </Disclosure>
    </Card>
    <Modal transparent visible={pickerVisible} animationType="fade" onRequestClose={() => setPickerVisible(false)}>
      <View style={{ flex: 1, backgroundColor: "#163c2a77", justifyContent: "center", padding: 16 }}>
        <View accessibilityViewIsModal style={{ backgroundColor: "white", borderRadius: 22, padding: 18, maxWidth: 480, width: "100%", maxHeight: "90%", alignSelf: "center" }}>
          <Text accessibilityRole="header" style={[styles.heading, { fontSize: 20, lineHeight: 28 }]}>替换{picker.name}</Text>
          <Text style={[styles.muted, { marginTop: 8, marginBottom: 14 }]}>只替换这项{picker.role}，其余食物保留。已按当前过敏、忌口、素食和做饭时间筛选。</Text>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {picker.choices.map(choice => <Pressable key={choice.id} accessibilityRole="button" accessibilityLabel={`换成 ${choice.name}`} onPress={() => { setSwaps(choice.swaps); setPickerVisible(false); }} style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginBottom: 8, minHeight: 48, opacity: pressed ? .65 : 1, backgroundColor: colors.bg })}>
              <Text style={styles.heading}>{choice.name}</Text><Text style={[styles.muted, { marginTop: 4 }]}>{choice.amount}</Text><Text style={[styles.muted, { fontSize: 12 }]}>替换后整餐约 {choice.minutes} 分钟</Text>
            </Pressable>)}
            {!picker.choices.length && <Text style={[styles.text, { paddingVertical: 16 }]}>暂时没有符合当前限制的同类替换，原搭配会保留。</Text>}
            <Text style={[styles.muted, { fontSize: 12, marginVertical: 8 }]}>这是同类搭配示例，不代表热量或碳水等量，份量可在记餐时调整。</Text>
          </ScrollView>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}><Action title="保留当前食物" kind="secondary" onPress={() => setPickerVisible(false)} /></View>
        </View>
      </View>
    </Modal>
  </>;
}
