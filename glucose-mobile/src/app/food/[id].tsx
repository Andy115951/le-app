import { useState } from "react";
import { Image, Linking, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FOODS } from "../../data/foods";
import { estimateGL } from "../../core/domain";
import { useApp } from "../../state/app-provider";
import { Action, Card, Field, Page, styles } from "../../components/ui";
import { FOOD_IMAGES } from "../../data/food-images";
export default function FoodDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const food = FOODS.find(item => item.id === id); const app = useApp(); const router = useRouter(); const [grams, setGrams] = useState("");
  if (!food) return <Page title="没有找到这条食物" back><Text style={styles.muted}>请返回食物列表重新选择。</Text></Page>;
  const gl = estimateGL(food, Number(grams) > 0 ? Number(grams) : null);
  return <Page title={food.name} back members={false}>
    <Image source={FOOD_IMAGES[food.id]} style={{ height: 190, width: "100%", borderRadius: 20, backgroundColor: "#edf3e8", marginBottom: 20 }} resizeMode="contain" />
    <Card><Text style={styles.value}>{food.giStatus === "known" ? `GI ${food.gi}` : food.giStatus === "not-applicable" ? "GI 不适用" : "GI 待核验"}</Text><Text style={styles.text}>{food.preparation}</Text><Text style={styles.muted}>{food.notes}</Text></Card>
    <Action title="加入餐饮记录" disabled={!app.activeProfile || !app.recordsReady || app.busy} onPress={() => router.push({ pathname: "/record", params: { kind: "meal", foodId: food.id, grams: Number(grams) > 0 ? grams : "" } })} />
    <Action title={app.favorites.includes(`food:${food.id}`) ? "取消收藏" : "收藏食物"} kind="secondary" disabled={!app.activeProfile || app.busy || !app.recordsReady} onPress={() => void app.toggleFavorite("food", food.id)} />
    {!app.activeProfile && <Action title="登录后记录与收藏" kind="ghost" onPress={() => router.push("/settings")} />}
    <Card style={{ marginTop: 18 }}><Text style={styles.heading}>看看这一份的 GL</Text><Field label="实际食用重量（克）" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder="填写实际克数" /><Text style={styles.value}>{gl ?? "—"}</Text><Text style={styles.muted}>只在数据口径匹配时估算，不能预测个人餐后血糖。</Text></Card>
    <Card><Text style={styles.heading}>数据与出处</Text>{food.sources.map((source, index) => <Action key={index} title={source.title} kind="ghost" onPress={() => void Linking.openURL(source.url)} />)}<Text style={styles.muted}>{food.sources.map(source => source.detail).filter(Boolean).join("\n")}</Text></Card>
  </Page>;
}
