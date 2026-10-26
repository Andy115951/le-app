import { useState } from "react";
import { Linking, Text } from "react-native";
import { useRouter } from "expo-router";
import type { MealTemplate, Profile } from "../../core/domain";
import { dayKey, mealNames } from "../../core/format";
import { initialRecordTime, suggestMealType } from "../../core/record-defaults";
import { mealSuggestions } from "../../core/meal-suggestions";
import type { MealSwaps } from "../../core/meal-substitutions";
import { MealSuggestionCard } from "../../components/meal-suggestion-card";
import { MEAL_TEMPLATES } from "../../data/meal-templates";
import { useApp } from "../../state/app-provider";
import { Access, Action, Card, Chips, colors, Disclosure, Page, styles } from "../../components/ui";

type MainMeal = "breakfast" | "lunch" | "dinner";

export default function Suggestions() {
  const app = useApp(); const profile = app.activeProfile;
  const day = dayKey(undefined, profile?.timezone);
  return <Page title="今天吃什么" dense compactMembers><Access>{profile && <MealIdea key={`${JSON.stringify(profile)}-${day}`} profile={profile} day={day} />}</Access></Page>;
}

function MealIdea({ profile, day }: { profile: Profile; day: string }) {
  const app = useApp(); const router = useRouter();
  const [type, setType] = useState<MainMeal>(() => {
    const time = initialRecordTime({ timezone: profile.timezone });
    const suggested = suggestMealType(time);
    return suggested === "snack" ? (Number(time.slice(11, 13)) < 10 ? "breakfast" : "dinner") : suggested;
  });
  const [rotations, setRotations] = useState({ breakfast: 0, lunch: 0, dinner: 0 });
  const options = mealSuggestions(MEAL_TEMPLATES, profile, day, type);
  const index = options.length ? rotations[type] % options.length : 0;
  const template = options[index];
  const limits = [profile.allergies.length ? `过敏：${profile.allergies.join("、")}` : "过敏未填写", profile.avoidances.length ? `忌口：${profile.avoidances.join("、")}` : "忌口未填写", ...(profile.maxCookingMinutes ? [`做饭 ≤${profile.maxCookingMinutes} 分钟`] : [])];
  function record(idea?: MealTemplate, swaps: MealSwaps = {}) {
    router.push({ pathname: "/record", params: { kind: "meal", mealType: type, day, ...(idea ? { templateId: idea.id, suggestedFor: profile.id, ...(Object.keys(swaps).length ? { swaps: JSON.stringify(swaps) } : {}) } : {}) } });
  }
  return <>
    <Text style={[styles.muted, { marginVertical: 8 }]}>{day} · 为 {profile.name} 搭配一餐</Text>
    <Chips value={type} onChange={setType} options={(["breakfast", "lunch", "dinner"] as const).map(value => ({ value, label: mealNames[value] }))} />
    <Text style={[styles.muted, { marginTop: 5, marginBottom: 14 }]}>{profile.preferences.join(" · ") || "按均衡搭配筛选"}{profile.maxCookingMinutes ? ` · ${profile.maxCookingMinutes} 分钟内` : ""} · <Text onPress={() => router.push({ pathname: "/profile", params: { id: profile.id } })} accessibilityRole="link" style={{ color: colors.green }}>调整偏好</Text></Text>
    {template ? <MealSuggestionCard key={`${type}-${template.id}`} base={template} profile={profile} mealName={mealNames[type]} index={index} total={options.length} busy={app.busy} onNext={() => setRotations(current => ({ ...current, [type]: current[type] + 1 }))} onRecord={record} /> : <Card><Text style={styles.heading}>暂时没有符合条件的搭配</Text><Text style={[styles.text, { marginVertical: 12 }]}>这餐还没有同时满足当前过敏、忌口和做饭时间的搭配，可以核对偏好，或自己记录一餐。</Text><Action title="核对饮食偏好" kind="secondary" onPress={() => router.push({ pathname: "/profile", params: { id: profile.id } })} /><Action title="自己记录这餐" kind="ghost" onPress={() => record()} /></Card>}
    <Disclosure title="搭配规则与当前偏好">
      <Text style={[styles.text, { marginBottom: 10 }]}>每餐安排主食、蛋白质食物和蔬菜，兼顾食材种类与清淡做法。</Text>
      <Text style={[styles.muted, { marginBottom: 10 }]}>{limits.join("；")}。偏好：{profile.preferences.join("、") || "未填写"}。</Text>
      <Text style={styles.muted}>先排除过敏与忌口，再限制做饭时间和素食要求；符合口味偏好的优先，每天轮换。“换一套”只在符合限制的搭配中选择。</Text>
      <Action title="编辑我的饮食偏好" kind="secondary" onPress={() => router.push({ pathname: "/profile", params: { id: profile.id } })} />
      <Text style={[styles.muted, { marginTop: 8 }]}>搭配供日常参考，不根据单次血糖调整下一餐；特殊医学营养需求遵循医疗团队的饮食安排。</Text>
      <Action title="查看餐盘搭配参考来源" kind="ghost" onPress={() => void Linking.openURL("https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes")} />
    </Disclosure>
  </>;
}
