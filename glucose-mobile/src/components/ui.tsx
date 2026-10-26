import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Droplet, RefreshCw } from "lucide-react-native";
import { useApp } from "../state/app-provider";
import { useKeyboardInset } from "./use-keyboard-inset";
export const colors = { bg: "#f8f9f5", ink: "#293e35", muted: "#687c6c", green: "#397965", soft: "#edf3e8", line: "#e2e9df", rose: "#f8eeeb" };
export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, maxWidth: "100%" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: "600", color: colors.ink, flexShrink: 1, minWidth: 0 },
  text: { fontSize: 15, lineHeight: 24, color: colors.ink, flexShrink: 1, minWidth: 0 },
  muted: { fontSize: 13, lineHeight: 22, color: colors.muted, flexShrink: 1, minWidth: 0 },
  value: { fontSize: 34, lineHeight: 46, fontWeight: "500", color: colors.green, flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 }, gap: { height: 18 },
  label: { fontSize: 14, lineHeight: 22, color: colors.ink, fontWeight: "500", marginBottom: 8 },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 12, minHeight: 50, minWidth: 0, width: "100%", paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, lineHeight: 24, color: colors.ink },
  card: { backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, marginBottom: 16, minWidth: 0 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, minHeight: 44, minWidth: 0, maxWidth: "100%", justifyContent: "center" },
});
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) { return <View style={[styles.card, style]}>{children}</View>; }
export function Action({ title, onPress, kind = "primary", disabled = false, icon, accessibilityLabel }: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; icon?: ReactNode; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 7, justifyContent: "center", alignItems: "center", paddingHorizontal: !title ? 12 : kind === "ghost" ? 5 : 14, paddingVertical: 12, borderRadius: 12, minHeight: 46, minWidth: 0, maxWidth: "100%", flexShrink: 1, backgroundColor: kind === "primary" ? colors.green : kind === "secondary" ? colors.soft : kind === "danger" ? colors.rose : "transparent", opacity: disabled ? .45 : pressed ? .7 : 1 })}><>{icon}{!!title && <Text style={{ fontSize: 14, lineHeight: 22, fontWeight: "600", flexShrink: 1, minWidth: 0, textAlign: "center", color: kind === "primary" ? "white" : kind === "danger" ? "#a33d3d" : colors.green }}>{title}</Text>}</></Pressable>;
}
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ marginVertical: 10, minWidth: 0, maxWidth: "100%" }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#8b998e" {...props} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: "top" }, props.style]} />{hint && <Text style={[styles.muted, { marginTop: 6 }]}>{hint}</Text>}</View>;
}
export function Select({ label, value, options, onChange, compact = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; compact?: boolean }) {
  const selected = options.find(option => option.value === value)?.label;
  return <View style={{ marginVertical: compact ? 6 : 10, minWidth: 0 }}><View style={compact ? { flexDirection: "row", alignItems: "center", gap: 12 } : undefined}><Text style={[styles.label, compact && { marginBottom: 0, fontSize: 13 }]}>{label}</Text><View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: "white", overflow: "hidden", minWidth: 0, ...(compact ? { flex: 1 } : {}) }}><Picker accessibilityLabel={label} selectedValue={value} onValueChange={onChange} style={{ color: colors.ink, minHeight: compact ? 44 : 50, width: "100%", minWidth: 0, borderWidth: 0, paddingHorizontal: 12, fontSize: 16, lineHeight: 24 }}>{options.map(option => <Picker.Item key={option.value} label={option.label} value={option.value} />)}</Picker></View></View>{selected && selected.length > 28 && <Text style={[styles.muted, { marginTop: 7 }]}>{selected}</Text>}</View>;
}
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 4 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={[styles.between, { minHeight: 48, flexWrap: "nowrap", paddingVertical: 10 }]}><Text style={[styles.text, { color: colors.green }]}>{title}</Text>{open ? <ChevronUp size={18} color={colors.green} /> : <ChevronDown size={18} color={colors.green} />}</Pressable>{open && children}</View>;
}
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <View style={[styles.row, { gap: 8, marginVertical: 7 }]}>{options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)} style={[styles.chip, value === option.value && { backgroundColor: colors.soft, borderColor: "#91ad89" }]}><Text style={{ color: value === option.value ? colors.green : colors.muted, fontSize: 14, lineHeight: 22, flexShrink: 1 }}>{option.label}</Text></Pressable>)}</View>;
}
export function Page({ title, eyebrow, children, back = false, refresh = true, members = true, compactMembers = false, dense = false, footer, headerNote, hideError = false }: { title: string; eyebrow?: string; children: ReactNode; back?: boolean; refresh?: boolean; members?: boolean; compactMembers?: boolean; dense?: boolean; footer?: ReactNode; headerNote?: string; hideError?: boolean }) {
  const app = useApp(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { width } = useWindowDimensions(); const compact = width < 480; const gutter = compact ? 16 : 24;
  const keyboardInset = useKeyboardInset();
  const notice = app.mode === "demo" && app.notice?.startsWith("正在使用演示数据") ? null : app.notice;
  const message = (!hideError && app.error) || notice;
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: footer ? keyboardInset : 0 }}>
    <View style={{ borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }}><View style={[styles.between, { paddingHorizontal: gutter, paddingVertical: 10, minHeight: 60, maxWidth: 1000, width: "100%", alignSelf: "center", flexWrap: "nowrap" }]}>
      {back ? <Action title="返回" kind="ghost" icon={<ArrowLeft size={18} color={colors.green} />} onPress={() => router.canGoBack() ? router.back() : router.replace("/")} /> : <View style={styles.row}><Droplet size={23} color={colors.green} /><Text style={{ fontSize: 20, fontWeight: "600", color: colors.ink }}>糖记</Text></View>}
      <Text style={[styles.muted, { textAlign: "right" }]}>{headerNote || (app.mode === "demo" ? "演示模式" : app.mode === "cloud" ? "云端手账" : "好好吃饭，慢慢记录")}</Text>
    </View></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: gutter, paddingBottom: 36 + (back ? insets.bottom : 0), width: "100%", maxWidth: 1000, alignSelf: "center" }} refreshControl={refresh ? <RefreshControl refreshing={app.busy} onRefresh={() => void app.refresh()} tintColor={colors.green} /> : undefined}>
      {!!eyebrow && <Text style={{ fontSize: 10, lineHeight: 16, letterSpacing: 2, color: colors.muted, marginBottom: 9 }}>{eyebrow}</Text>}<Text accessibilityRole="header" style={[styles.title, compact && { fontSize: 24, lineHeight: 34 }]}>{title}</Text><View style={{ height: dense ? 6 : 14 }} />
      {app.mode === "demo" && <Text style={[styles.muted, { fontSize: 12, lineHeight: 18, marginBottom: dense ? 6 : 12 }]}>合成示例仅本次可见，刷新后清空。</Text>}
      {members && app.activeProfile && <Select compact={compactMembers} label="当前记录成员" value={app.activeProfile.id} options={app.profiles.map(profile => ({ value: profile.id, label: profile.name }))} onChange={app.setActiveProfile} />}
      {message && <Pressable accessibilityRole="button" accessibilityLabel="关闭提示" onPress={app.clearMessages} style={{ padding: 12, backgroundColor: !hideError && app.error ? "#fff0e9" : colors.soft, borderRadius: 12, marginVertical: 10 }}><Text accessibilityRole={!hideError && app.error ? "alert" : "text"} style={styles.text}>{message}</Text></Pressable>}
      {children}<Text style={[styles.muted, { marginTop: 20, textAlign: "center", fontSize: 11 }]}>用于日常记录与饮食学习 · 诊疗及目标遵循医疗团队建议</Text>
    </ScrollView>
    {!!footer && <View style={{ backgroundColor: "white", borderTopWidth: 1, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 10 }}><View style={{ paddingHorizontal: gutter, width: "100%", maxWidth: 1000, alignSelf: "center" }}>{footer}</View></View>}
  </KeyboardAvoidingView>;
}
export function Access({ children }: { children: ReactNode }) {
  const app = useApp(); const router = useRouter();
  if (app.mode === "loading") return <Card><ActivityIndicator color={colors.green} /><Text style={styles.muted}>正在打开手账…</Text></Card>;
  if (!app.activeProfile) return <Card><Text style={styles.heading}>{app.mode === "cloud" ? app.enrolled ? "先添加一位成员" : "账号尚未开通" : "给每一天，留一点记录"}</Text><Text style={[styles.muted, { marginVertical: 12 }]}>登录后，和网页版共用你与家人的记录。</Text><Action title={app.mode === "cloud" ? "前往我的" : "登录 / 开通账号"} onPress={() => router.push("/settings")} />{app.mode !== "cloud" && <Action title="先体验一下" kind="secondary" onPress={() => void app.enterDemo()} />}</Card>;
  if (!app.recordsReady) return <Card><Text style={styles.text}>成员记录尚未读取完成。</Text><Action title="重新读取" disabled={app.busy} icon={<RefreshCw size={16} color="white" />} onPress={() => void app.refresh()} /></Card>;
  return children;
}
