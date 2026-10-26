import { Tabs } from "expo-router";
import { BookOpen, Home, NotebookPen, Sprout, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#397965", tabBarInactiveTintColor: "#73816f", tabBarLabelPosition: "below-icon", tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e2e9df", height: 64 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(8, insets.bottom) }, tabBarIconStyle: { height: 24, width: 24, marginBottom: 3 }, tabBarLabelStyle: { fontSize: 12, lineHeight: 18, minHeight: 18, flexShrink: 0, fontWeight: "500" } }}>
    <Tabs.Screen name="index" options={{ title: "今日", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
    <Tabs.Screen name="foods" options={{ title: "查食物", tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
    <Tabs.Screen name="suggestions" options={{ title: "吃什么", tabBarIcon: ({ color, size }) => <Sprout color={color} size={size} /> }} />
    <Tabs.Screen name="history" options={{ title: "历史", tabBarIcon: ({ color, size }) => <NotebookPen color={color} size={size} /> }} />
    <Tabs.Screen name="settings" options={{ title: "我的", tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
  </Tabs>;
}
