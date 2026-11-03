import React, { useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import { money, parseMoney } from "@ledger/core";
import { Text } from "./appearance";
import { VaultScene } from "./little-vault";
import { VaultSlider } from "./vault-slider";
import { colors as c, styles as s } from "./theme";

const maximum = 1_000_000_000; // Preview only: CNY 10 million, in cents.
const scale = Math.log1p(maximum / 100);
const position = (minor: number) => Math.log1p(minor / 100) / scale;
function amountAt(value: number) {
  const yuan = Math.expm1(Math.max(0, Math.min(1, value)) * scale);
  // Keep large amounts readable while retaining fine control for small savings.
  const step =
    yuan < 10 ? 0.01 : 10 ** Math.max(0, Math.floor(Math.log10(yuan)) - 2);
  return Math.max(
    0,
    Math.min(maximum, Math.round(yuan / step) * Math.round(step * 100)),
  );
}
const presets = [
  ["空金库", 0],
  ["10 元", 1_000],
  ["100 元", 10_000],
  ["1 千", 100_000],
  ["1 万", 1_000_000],
  ["10 万", 10_000_000],
  ["100 万", 100_000_000],
  ["混合看看", 1_234_567],
] as const;

/** Fictional, transient amounts only. No repository or preference access. */
export function VaultPreview() {
  const [minor, setMinor] = useState(13_500);
  const [draft, setDraft] = useState("135.00");
  const [error, setError] = useState("");
  const choose = (value: number) => {
    setMinor(value);
    setDraft(money(value));
    setError("");
  };
  const apply = () => {
    try {
      const value = parseMoney(draft);
      if (value < 0 || value > maximum) {
        setError("预览金额请输入 0 到 1,000 万元，最多两位小数");
        return;
      }
      choose(value);
      Keyboard.dismiss();
    } catch {
      setError("请输入有效金额，最多两位小数");
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", gap: 5 }}>
        <Text style={[s.muted, { color: c.brand }]}>演示金额 · 不影响账本</Text>
        <Text
          variant="amount"
          style={[s.amount, { fontSize: 30, lineHeight: 42 }]}
        >
          ¥{" "}
          {Number(money(minor)).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>
      <View style={{ height: 320, justifyContent: "center" }}>
        <View style={{ width: "100%", maxWidth: 280, alignSelf: "center" }}>
          <VaultScene netMinor={minor} visible />
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <VaultSlider
          valueText={`${money(minor)} 元，演示金额`}
          value={position(minor)}
          onValueChange={(value) => choose(amountAt(value))}
        />
        <View style={{ height: 21 }}>
          <Text style={[s.muted, { position: "absolute", left: 0 }]}>0 元</Text>
          <Text
            style={[
              s.muted,
              {
                position: "absolute",
                left: `${position(1_000_000) * 100}%`,
                width: 60,
                marginLeft: -30,
                textAlign: "center",
              },
            ]}
          >
            1 万
          </Text>
          <Text style={[s.muted, { position: "absolute", right: 0 }]}>
            1,000 万
          </Text>
        </View>
        <Text style={[s.muted, { textAlign: "center", marginTop: 6 }]}>
          拖一拖，看积攒变成金子 · 小金额可精细调节
        </Text>
      </View>
      <View style={s.wrap}>
        {presets.map(([label, value]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`预览${label}`}
            accessibilityState={{ selected: minor === value }}
            onPress={() => choose(value)}
            style={[
              s.chip,
              { flexGrow: 1, minWidth: 64, alignItems: "center" },
              minor === value && s.selected,
            ]}
          >
            <Text style={[s.muted, minor === value && { color: c.brand }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <Text style={s.text}>也可以看看一个具体金额</Text>
        <View style={s.row}>
          <TextInput
            accessibilityLabel="自定义预览金额（元）"
            placeholder="输入金额，单位元"
            keyboardType="decimal-pad"
            returnKeyType="done"
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setError("");
            }}
            onSubmitEditing={apply}
            maxLength={12}
            style={[s.input, { flex: 1 }]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={apply}
            style={[s.button, s.secondary]}
          >
            <Text style={[s.buttonText, s.secondaryText]}>看看</Text>
          </Pressable>
        </View>
        {error !== "" && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
      </View>
      <Text style={s.muted}>
        预览与真实资产、小眼睛及金库开关相互独立，离开后不保存。滑杆演示至 1,000
        万元，这不是账本金额上限。
      </Text>
    </View>
  );
}
