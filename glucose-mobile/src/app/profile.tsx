import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ALLERGENS, PREFERENCES, type Profile, type Unit } from "../core/domain";
import { uuid } from "../core/runtime";
import { useApp } from "../state/app-provider";
import { Action, Card, Field, Page, Select, styles, colors } from "../components/ui";
import { useDraftGuard } from "../components/draft-guard";
export default function ProfilePage() {
  const app = useApp(); const { id } = useLocalSearchParams<{ id?: string }>();
  const profile = id ? app.profiles.find(item => item.id === id) : undefined;
  if (!(app.enrolled || app.mode === "demo") || (id && !profile)) return <Page title="请先登录并读取成员" back members={false}><Text style={styles.muted}>成员已变化，请返回后刷新重试。</Text></Page>;
  return <ProfileForm key={id || "new"} existing={profile} />;
}
function ProfileForm({ existing }: { existing?: Profile }) {
  const app = useApp(); const router = useRouter();
  const [profile, setProfile] = useState<Profile>(() => existing || { id: uuid(), name: "", unit: "mmol/L", timezone: "Asia/Shanghai", allergies: [], avoidances: [], preferences: ["均衡"], maxCookingMinutes: null, targets: {} });
  const [avoidances, setAvoidances] = useState(profile.avoidances.join("，")); const [minutes, setMinutes] = useState(profile.maxCookingMinutes?.toString() || ""); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const [baseline] = useState(JSON.stringify([profile, avoidances, minutes]));
  useDraftGuard(!done && JSON.stringify([profile, avoidances, minutes]) !== baseline, !done && app.busy);
  useEffect(() => { if (done) { if (router.canGoBack()) router.back(); else router.replace("/settings"); } }, [done, router]);
  const patch = (changes: Partial<Profile>) => setProfile({ ...profile, ...changes });
  function choices(label: string, options: string[], field: "allergies" | "preferences") { return <View style={{ marginVertical: 12 }}><Text style={styles.label}>{label}</Text><View style={styles.row}>{options.map(option => <Pressable key={option} accessibilityRole="checkbox" accessibilityState={{ checked: profile[field].includes(option) }} onPress={() => patch({ [field]: profile[field].includes(option) ? profile[field].filter(item => item !== option) : [...profile[field], option] })} style={[styles.chip, profile[field].includes(option) && { backgroundColor: colors.soft }]}><Text style={styles.text}>{option}</Text></Pressable>)}</View></View>; }
  async function save() {
    setError("");
    if (minutes && (!/^\d+$/.test(minutes) || +minutes < 1 || +minutes > 240)) { setError("做饭时间请填写 1–240 的整分钟，或留空。"); return; }
    const ok = await app.saveProfile({ ...profile, name: profile.name.trim(), avoidances: avoidances.split(/[,，、\n]/).map(item => item.trim()).filter(Boolean), maxCookingMinutes: minutes ? +minutes : null });
    if (ok) setDone(true);
  }
  return <Page title={existing ? "编辑成员档案" : "添加本人 / 家人"} back refresh={false} members={false}><Card>
    <Field label="成员昵称" value={profile.name} onChangeText={name => patch({ name })} maxLength={80} placeholder="比如：我、妈妈" />
    <Select label="显示单位" value={profile.unit} onChange={unit => patch({ unit: unit as Unit })} options={[{ value: "mmol/L", label: "mmol/L" }, { value: "mg/dL", label: "mg/dL" }]} />
    <Field label="成员时区" value={profile.timezone} onChangeText={timezone => patch({ timezone })} autoCapitalize="none" placeholder="Asia/Shanghai" hint="中国大陆使用 Asia/Shanghai。按成员时区归属日期。" />
    {choices("过敏原", ALLERGENS, "allergies")}<Field label="忌口（逗号分隔）" value={avoidances} onChangeText={setAvoidances} />{choices("饮食偏好", PREFERENCES, "preferences")}
    <Field label="做饭时间上限（分钟，可选）" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
    <Text style={styles.muted}>现有自设目标范围会保留，首版可在网页版调整。</Text>{!!error && <Text accessibilityRole="alert" style={{ color: "#a33d3d" }}>{error}</Text>}
    <Action title={app.busy ? "正在保存…" : "保存成员"} disabled={app.busy} onPress={() => void save()} />
  </Card></Page>;
}
