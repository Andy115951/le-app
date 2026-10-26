import type { ChangeEvent } from "react";
import { View, Text } from "react-native";
import { styles } from "./ui";
export function DateTimeField({ value, onChange, dateOnly = false, compact = false, label = dateOnly ? "记录日期" : "实际日期时间" }: { value: string; onChange: (value: string) => void; dateOnly?: boolean; compact?: boolean; label?: string }) {
  return <View style={{ marginVertical: compact ? 0 : 12, minWidth: 0 }}>{!compact && <Text style={styles.label}>{label}</Text>}<input aria-label={label} type={dateOnly ? "date" : "datetime-local"} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.value) onChange(event.target.value); }} style={{ border: "1px solid #e2e9df", borderRadius: 12, padding: compact ? 10 : 12, minHeight: compact ? 44 : 50, fontSize: 16, lineHeight: "24px", fontFamily: "inherit", backgroundColor: "white", color: "#293e35", width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }} /></View>;
}
