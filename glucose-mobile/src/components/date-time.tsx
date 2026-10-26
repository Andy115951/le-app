import { Field } from "./ui";
export function DateTimeField({ value, onChange, dateOnly = false, compact = false, label = dateOnly ? "记录日期" : "实际日期时间" }: { value: string; onChange: (value: string) => void; dateOnly?: boolean; compact?: boolean; label?: string }) {
  return <Field label={compact ? "" : label} value={value.replace("T", " ")} onChangeText={text => onChange(text.replace(" ", "T"))} placeholder={dateOnly ? "2026-10-21" : "2026-10-21 07:30"} autoCapitalize="none" hint={dateOnly ? "格式：年-月-日" : "格式：年-月-日 时:分，使用当前成员时区"} />;
}
