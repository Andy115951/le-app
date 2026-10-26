import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../../state/app-provider";
import { Action, Card, Field, Page, styles } from "../../components/ui";
import { useConfirm } from "../../components/confirmation";
import { WEB_ORIGIN } from "../../platform/cloud-client";
export default function Settings() {
  const app = useApp(); const router = useRouter(); const ask = useConfirm(); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  function openWeb(path = "") { if (WEB_ORIGIN) void Linking.openURL(`${WEB_ORIGIN}${path}`); }
  async function login() { const ok = await app.signIn(email, password); if (ok) setPassword(""); }
  return <Page title="我的与家人" eyebrow="A LITTLE CARE FOR YOUR FAMILY" members={false}>
    {app.mode === "cloud" ? <Card><Text style={styles.heading}>已登录</Text><Text style={styles.text}>{app.user?.email}</Text><Text style={styles.muted}>{app.enrolled ? "账号已开通，与网页版共用记录。" : "请先在网页开通此账号，再返回刷新。"}</Text>{!app.enrolled && <>{WEB_ORIGIN && <Action title="在网页开通账号" onPress={() => openWeb("/settings")} />}<Action title="重新检查开通状态" kind="secondary" disabled={app.busy} onPress={() => void app.refresh()} /></>}<Action title="退出登录" kind="ghost" disabled={app.busy} onPress={() => { void ask({ title: "退出登录？", message: "当前设备内存中的私人记录会清空，云端已保存的数据仍保留。", confirmText: "退出登录" }).then(ok => { if (ok) void app.signOut(); }); }} /></Card> : <Card><Text style={styles.heading}>{app.mode === "demo" ? "开启自己的云端手账" : "欢迎回来"}</Text><Text style={[styles.muted, { marginVertical: 10 }]}>使用网页版同一邮箱和密码登录。</Text>
      <Field label="邮箱" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="你的邮箱" />
      <Field label="密码" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" placeholder="输入密码" onSubmitEditing={() => { if (email && password && !app.busy) void login(); }} />
      <Action title={app.busy ? "正在连接…" : "登录"} disabled={!email.trim() || !password || app.busy} onPress={() => void login()} />
      {WEB_ORIGIN && <Action title="在网页注册 / 开通账号" kind="ghost" onPress={() => openWeb("/settings")} />}
      {app.mode !== "demo" && <Action title="体验合成演示" kind="secondary" disabled={app.busy} onPress={() => { void app.enterDemo().then(ok => { if (ok) router.replace("/"); }); }} />}
      {app.mode === "demo" && <Action title="退出演示" kind="ghost" onPress={() => void app.signOut()} />}
    </Card>}
    {!!app.profiles.length && <Text style={[styles.heading, { marginBottom: 14 }]}>本人和家人</Text>}
    {app.profiles.map(profile => <Card key={profile.id}><View style={styles.between}><Text style={styles.heading}>{profile.name}</Text><Text style={styles.muted}>{app.activeProfile?.id === profile.id ? "当前成员" : ""}</Text></View><Text style={styles.muted}>{profile.unit} · {profile.timezone}</Text><Text style={styles.muted}>过敏：{profile.allergies.join("、") || "未填写"}</Text><View style={styles.row}><Action title="切换成员" kind="secondary" disabled={app.busy || app.activeProfile?.id === profile.id} onPress={() => app.setActiveProfile(profile.id)} /><Action title="编辑档案" kind="ghost" disabled={app.busy} onPress={() => router.push({ pathname: "/profile", params: { id: profile.id } })} /></View></Card>)}
    {(app.enrolled || app.mode === "demo") && <Action title="添加本人 / 家人" disabled={app.busy} onPress={() => router.push("/profile")} />}
    <Card style={{ marginTop: 20 }}><Text style={styles.heading}>糖记 0.1.0</Text><Text style={styles.muted}>安卓优先 · 同一套 Expo 页面支持 Web</Text><Text style={styles.muted}>私人记录联网保存；食物资料可以离线查询。</Text>{WEB_ORIGIN && <Action title="打开网页版" kind="ghost" onPress={() => openWeb()} />}</Card>
  </Page>;
}
