import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, View, Text } from "react-native";
import { Action, styles } from "./ui";
export function DateTimeField({ value, onChange, dateOnly = false, compact = false, label = dateOnly ? "记录日期" : "实际日期时间" }: { value: string; onChange: (value: string) => void; dateOnly?: boolean; compact?: boolean; label?: string }) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const parts = value.split(/[-T:]/).map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3] || 0, parts[4] || 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <View style={{ marginVertical: compact ? 0 : 12 }}>{!compact && <Text style={styles.label}>{label}</Text>}<View style={styles.row}><Action title={value.slice(0, 10)} kind="secondary" onPress={() => setMode("date")} />{!dateOnly && <Action title={value.slice(11, 16)} kind="secondary" onPress={() => setMode("time")} />}</View>
    {mode && <><DateTimePicker value={date} mode={mode} is24Hour display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, selected) => {
      if (Platform.OS === "android") setMode(null);
      if (!selected || event.type === "dismissed") return;
      const day = mode === "date" ? `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}` : value.slice(0, 10);
      const clock = mode === "time" ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : value.slice(11, 16);
      onChange(dateOnly ? day : `${day}T${clock}`);
    }} />{Platform.OS === "ios" && <Action title="完成选择" onPress={() => setMode(null)} />}</>}
  </View>;
}
