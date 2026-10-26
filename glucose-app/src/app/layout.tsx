import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-provider";
import { UnsavedChangesProvider } from "@/components/unsaved-changes";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "糖记 · 好好吃饭，慢慢记录", template: "%s · 糖记" },
  description: "给自己和家人的血糖与饮食小手账。查食物、记血糖、记录每一餐。",
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f9f5" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body><AppProvider><UnsavedChangesProvider><AppShell>{children}</AppShell></UnsavedChangesProvider></AppProvider></body></html>;
}
