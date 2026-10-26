import "../platform/bootstrap";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../state/app-provider";
import { ConfirmationProvider } from "../components/confirmation";
export default function RootLayout() {
  return <SafeAreaProvider><AppProvider><ConfirmationProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f8f9f5" } }}><Stack.Screen name="(tabs)" /><Stack.Screen name="record" options={{ presentation: "modal", gestureEnabled: false }} /><Stack.Screen name="profile" options={{ presentation: "modal", gestureEnabled: false }} /></Stack></ConfirmationProvider></AppProvider></SafeAreaProvider>;
}
