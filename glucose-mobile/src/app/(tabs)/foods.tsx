import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FOODS } from "../../data/foods";
import { FOOD_CATEGORIES, giBand } from "../../core/domain";
import { useApp } from "../../state/app-provider";
import { Card, Chips, Field, Page, Select, styles } from "../../components/ui";
import { FOOD_IMAGES } from "../../data/food-images";
export default function Foods() {
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("全部"); const [band, setBand] = useState("all"); const [favorite, setFavorite] = useState("all");
  const app = useApp(); const router = useRouter();
  const foods = FOODS.filter(food => (!search.trim() || [food.name, ...food.aliases].some(name => name.toLowerCase().includes(search.trim().toLowerCase()))) && (category === "全部" || category === food.category) && (band === "all" || giBand(food.gi) === band) && (favorite === "all" || app.favorites.includes(`food:${food.id}`)));
  return <Page title="了解食物，也了解自己" eyebrow="KNOW YOUR FOOD" members={!!app.activeProfile}>
    <Field label="搜索食物" value={search} onChangeText={setSearch} placeholder="比如：燕麦、苹果、米饭" />
    <Select label="食物分类" value={category} onChange={setCategory} options={["全部", ...FOOD_CATEGORIES].map(value => ({ value, label: value }))} />
    <Select label="GI 筛选" value={band} onChange={setBand} options={[{ value: "all", label: "全部 GI 状态" }, { value: "low", label: "低 GI ≤55" }, { value: "medium", label: "中 GI 56–69" }, { value: "high", label: "高 GI ≥70" }, { value: "unknown", label: "暂无数据 / 不适用" }]} />
    <Chips value={favorite} onChange={setFavorite} options={[{ value: "all", label: "全部食物" }, { value: "favorites", label: "我的收藏" }]} />
    <Text style={[styles.muted, { marginVertical: 14 }]}>找到 {foods.length} 种食物 · GI 对应特定样品与做法</Text>
    {foods.map(food => <Pressable key={food.id} accessibilityRole="button" accessibilityLabel={`查看${food.name}`} onPress={() => router.push({ pathname: "/food/[id]", params: { id: food.id } })}><Card><View style={[styles.row, { flexWrap: "nowrap" }]}><Image accessibilityIgnoresInvertColors source={FOOD_IMAGES[food.id]} style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: "#f1f5eb" }} /><View style={{ flex: 1 }}><Text style={styles.heading}>{food.name}</Text><Text style={styles.muted}>{food.giStatus === "known" ? `GI ${food.gi}` : food.giStatus === "not-applicable" ? "GI 不适用" : "GI 待核验"} · {food.category}</Text><Text style={styles.muted}>{food.portionLabel}</Text></View></View></Card></Pressable>)}
    {!foods.length && <Card><Text style={styles.text}>{favorite === "favorites" && !app.activeProfile ? "登录或进入演示后查看成员收藏。" : "没有找到匹配食物，试试其他关键词或分类。"}</Text></Card>}
  </Page>;
}
