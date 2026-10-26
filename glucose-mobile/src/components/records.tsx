import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { Droplet, Utensils } from "lucide-react-native";
import type { Meal, Reading } from "../core/domain";
import { contexts, displayValue, mealNames, mealSummary, timeLabel } from "../core/format";
import { useApp } from "../state/app-provider";
import { Action, Card, colors, styles } from "./ui";
export function RecordActions({ day }: { day?: string }) {
  const app = useApp(); const router = useRouter();
  const disabled = app.busy || !app.activeProfile || !app.recordsReady;
  return <View style={[styles.row, { marginBottom: 18 }]}><Action title="记饮食" kind="secondary" disabled={disabled} icon={<Utensils size={17} color={colors.green} />} onPress={() => router.push({ pathname: "/record", params: { kind: "meal", day } })} /><Action title="记血糖" disabled={disabled} icon={<Droplet size={17} color="white" />} onPress={() => router.push({ pathname: "/record", params: { kind: "reading", day } })} /></View>;
}
export function MealCard({ meal }: { meal: Meal }) {
  const app = useApp(); const router = useRouter();
  return <Card><View style={styles.between}><Text style={styles.heading}>{mealNames[meal.type]}</Text><Text style={styles.muted}>{timeLabel(meal.startedAt, app.activeProfile?.timezone, true)}</Text></View><Text style={[styles.text, { marginVertical: 10 }]}>{mealSummary(meal)}</Text>{!!meal.notes && <Text style={styles.muted}>{meal.notes}</Text>}<View style={styles.row}><Action title="同餐回看" kind="secondary" onPress={() => router.push({ pathname: "/meal/[id]", params: { id: meal.id } })} /><Action title="修改这餐" kind="ghost" disabled={app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "meal", id: meal.id } })} /></View></Card>;
}
export function ReadingCard({ reading }: { reading: Reading }) {
  const app = useApp(); const router = useRouter();
  return <Card><View style={styles.between}><Text style={styles.heading}>{contexts[reading.context]}测量</Text><Text style={styles.muted}>{timeLabel(reading.measuredAt, app.activeProfile?.timezone, true)}</Text></View><Text style={[styles.value, { marginTop: 8 }]}>{displayValue(reading, app.activeProfile?.unit)} <Text style={styles.muted}>{app.activeProfile?.unit}</Text></Text>{reading.postMealMinutes !== null && <Text style={styles.muted}>餐后 {reading.postMealMinutes} 分钟</Text>}{!!reading.notes && <Text style={styles.muted}>{reading.notes}</Text>}<View style={styles.row}>{reading.mealId && app.meals.some(meal => meal.id === reading.mealId && meal.profileId === reading.profileId) && <Action title="回看关联餐食" kind="secondary" onPress={() => router.push({ pathname: "/meal/[id]", params: { id: reading.mealId! } })} />}<Action title="修改测量" kind="ghost" disabled={app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "reading", id: reading.id } })} /></View></Card>;
}
