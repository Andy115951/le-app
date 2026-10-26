import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "../../state/app-provider";
import { dayKey, mealNames, timeLabel } from "../../core/format";
import { readingsForMeal, timingFromMeal } from "../../core/meal-review";
import { Access, Action, Card, Page, styles } from "../../components/ui";
import { ReadingCard } from "../../components/records";
export default function MealReview() {
  const { id } = useLocalSearchParams<{ id: string }>(); const app = useApp(); const router = useRouter();
  const meal = app.meals.find(item => item.id === id && item.profileId === app.activeProfile?.id);
  const profile = app.activeProfile;
  return <Page title={meal ? `同餐回看 · ${mealNames[meal.type]}` : "同餐回看"} back members={false}><Access>{meal && profile ? <>
    <Card><Text style={styles.heading}>这餐吃了什么</Text><Text style={styles.muted}>{timeLabel(meal.startedAt, profile.timezone, true)} 开始 · {profile.name}</Text>{meal.items.map(item => <View key={item.id} style={[styles.between, { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#e2e9df", alignItems: "flex-start" }]}><Text style={[styles.text, { flex: 1 }]}>{item.name}</Text><Text style={styles.text}>{item.quantity}{item.unit}</Text></View>)}{!!meal.notes && <Text style={[styles.muted, { marginVertical: 14 }]}>用餐备注：{meal.notes}</Text>}<Action title="修改这餐" kind="secondary" disabled={app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "meal", id: meal.id } })} /></Card>
    <View style={[styles.row, { marginBottom: 18 }]}>{(["before-meal", "after-meal"] as const).map(context => <Action key={context} title={context === "before-meal" ? "补记餐前" : "补记餐后"} kind={context === "before-meal" ? "secondary" : "primary"} disabled={app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "reading", context, mealId: meal.id, day: dayKey(meal.startedAt, profile.timezone) } })} />)}</View>
    <Text style={[styles.heading, { marginBottom: 12 }]}>关联实测 · {readingsForMeal(meal, app.readings).length} 次</Text>
    {!readingsForMeal(meal, app.readings).length && <Card><Text style={styles.muted}>这餐还没有关联血糖，可以补记餐前或餐后测量。</Text></Card>}
    {readingsForMeal(meal, app.readings).map(reading => <View key={reading.id}><Text style={[styles.muted, { marginBottom: 8 }]}>{timingFromMeal(meal, reading)} · 原始 {reading.special || reading.value} {reading.unit}</Text><ReadingCard reading={reading} /></View>)}
    <Text style={styles.muted}>按实际测量时间排列，保留跨日记录。仅显示明确关联到这餐的实测。</Text>
  </> : <Card><Text style={styles.text}>餐食已删除或不属于当前成员，请返回刷新后重试。</Text></Card>}</Access></Page>;
}
