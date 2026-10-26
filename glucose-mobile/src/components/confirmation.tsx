import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
type Question = { title: string; message: string; confirmText?: string; cancelText?: string };
const Context = createContext<(question: Question) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(Context);
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [visible, setVisible] = useState(false);
  const resolve = useRef<((ok: boolean) => void) | null>(null);
  function answer(ok: boolean) { setVisible(false); resolve.current?.(ok); resolve.current = null; }
  function ask(next: Question) {
    resolve.current?.(false);
    return new Promise<boolean>(done => { resolve.current = done; setQuestion(next); setVisible(true); });
  }
  return <Context.Provider value={ask}>{children}<Modal transparent visible={visible} animationType="fade" onRequestClose={() => answer(false)}>
    <View style={s.overlay}><View style={s.card} accessibilityViewIsModal>
      <Text accessibilityRole="header" style={s.title}>{question?.title}</Text><Text style={s.message}>{question?.message}</Text>
      <View style={s.actions}><Pressable accessibilityRole="button" onPress={() => answer(false)} style={s.secondary}><Text style={s.dark}>{question?.cancelText || "取消"}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => answer(true)} style={s.primary}><Text style={s.light}>{question?.confirmText || "确认"}</Text></Pressable></View>
    </View></View>
  </Modal></Context.Provider>;
}
const s = StyleSheet.create({ overlay: { flex: 1, backgroundColor: "#163c2a77", justifyContent: "center", padding: 18 }, card: { backgroundColor: "white", borderRadius: 22, padding: 22, maxWidth: 420, width: "100%", alignSelf: "center" }, title: { fontSize: 21, lineHeight: 30, color: "#293e35", fontWeight: "600" }, message: { color: "#617369", fontSize: 15, lineHeight: 25, marginVertical: 20 }, actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }, primary: { backgroundColor: "#397965", padding: 14, borderRadius: 12, maxWidth: "100%", minHeight: 48, flexShrink: 1 }, secondary: { backgroundColor: "#edf3e8", padding: 14, borderRadius: 12, maxWidth: "100%", minHeight: 48, flexShrink: 1 }, dark: { color: "#355c49", fontWeight: "600", lineHeight: 22, textAlign: "center" }, light: { color: "white", fontWeight: "600", lineHeight: 22, textAlign: "center" } });
