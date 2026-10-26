import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { addDays } from "../../core/domain";
import { dayKey, displayValue, mealNames } from "../../core/format";
import { useApp } from "../../state/app-provider";
import { Access, Action, Card, colors, Page, styles } from "../../components/ui";
import { DateTimeField } from "../../components/date-time";
import { MealCard, ReadingCard, RecordActions } from "../../components/records";
export default function Today() {
  const app = useApp();
  return <TodayContent key={`${app.activeProfile?.id}-${app.activeProfile?.timezone}`} />;
}
function TodayContent() {
  const app = useApp(); const router = useRouter(); const tz = app.activeProfile?.timezone || "Asia/Shanghai";
  const [day, setDay] = useState(dayKey(undefined, tz));
  const [showPresets, setShowPresets] = useState(false);
  const readings = app.readings.filter(reading => dayKey(reading.measuredAt, tz) === day).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const meals = app.meals.filter(meal => dayKey(meal.startedAt, tz) === day);
  const timeline = [...readings.map(reading => ({ kind: "reading" as const, time: reading.measuredAt, reading })), ...meals.map(meal => ({ kind: "meal" as const, time: meal.startedAt, meal }))].sort((a, b) => b.time.localeCompare(a.time));
  return <Page title="今天，也好好照顾自己" dense compactMembers><Access>
    <View style={[styles.row, { flexWrap: "nowrap", marginTop: 6, marginBottom: 12, gap: 8 }]}><Action title="" accessibilityLabel="前一天" kind="ghost" icon={<ChevronLeft size={20} color={colors.green} />} onPress={() => setDay(addDays(day, -1))} /><View style={{ flex: 1, minWidth: 0 }}><DateTimeField compact value={day} onChange={setDay} dateOnly /></View><Action title="" accessibilityLabel="后一天" kind="ghost" icon={<ChevronRight size={20} color={colors.green} />} onPress={() => setDay(addDays(day, 1))} /></View>
    <Card><Text style={styles.muted}>这一天 · 最近一次血糖</Text><View style={[styles.between, { alignItems: "flex-end" }]}><Text style={styles.value}>{readings[0] ? displayValue(readings[0], app.activeProfile?.unit) : "—"} <Text style={styles.muted}>{app.activeProfile?.unit}</Text></Text><Text style={[styles.muted, { paddingBottom: 5 }]}>{readings.length} 次实测 · {meals.length} 餐饮食</Text></View></Card>
    <RecordActions day={day} />
    <View style={[styles.between, { marginTop: -8, marginBottom: 12 }]}><Action title={showPresets ? "收起常吃组合" : `常吃组合 · ${app.mealPresets.length}`} kind="ghost" onPress={() => setShowPresets(!showPresets)} /><Action title="创建组合" kind="ghost" disabled={app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "meal", createPreset: "1", day } })} /></View>
    {showPresets && <>{!app.mealPresets.length && <Card><Text style={styles.muted}>保存常吃的食物与份量，下次记餐直接带入。</Text></Card>}{app.mealPresets.map(preset => <Card key={preset.id}><Text style={styles.heading}>{preset.name}</Text><Text style={styles.muted}>{mealNames[preset.mealType]} · {preset.items.map(item => `${item.name} ${item.quantity}${item.unit}`).join("、")}</Text><Action title="带入记餐" kind="secondary" disabled={app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "meal", presetId: preset.id, day } })} /></Card>)}</>}
    <Text style={[styles.heading, { marginBottom: 14 }]}>这一天的小记</Text>{!timeline.length && <Card><Text style={styles.muted}>这一天还没有记录，可以补记一笔。</Text></Card>}
    {timeline.map(entry => entry.kind === "reading" ? <ReadingCard key={entry.reading.id} reading={entry.reading} /> : <MealCard key={entry.meal.id} meal={entry.meal} />)}
  </Access></Page>;
}
