import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../client/src/appearance";
import { VaultScene } from "../client/src/little-vault";
import { colors as c, styles as s } from "../client/src/theme";

// Fixed fictional values only; this gallery never opens financial storage.
const amounts = [
  1135, 11135, 99999.99, 35, 135, 580, 999.99, 9999.99, 40000, 100000,
  128888.88, 999999.99, 1000000, 1999999.99, 90000000000, 0, 0.01, 5, 10, 1000,
  10000, -135,
];

export function VaultGallery() {
  const [visible, setVisible] = useState(true);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          padding: 20,
          gap: 18,
          maxWidth: 1400,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Text variant="heading" style={s.title}>
          小金库 · 小额与面额检查
        </Text>
        <Text style={s.muted}>虚构金额 · 正式共用组件 · 不读取或写入账本</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible((v) => !v)}
          style={[s.button, { alignSelf: "flex-start" }]}
        >
          <Text style={s.buttonText}>
            {visible ? "隐藏所有金库" : "显示所有金库"}
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
          {amounts.map((amount) => (
            <View
              key={amount}
              style={{
                width: "100%",
                maxWidth: 320,
                padding: 10,
                gap: 8,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 16,
              }}
            >
              {visible && (
                <Text
                  variant="amount"
                  style={[s.stat, { textAlign: "center" }]}
                >
                  ¥{" "}
                  {amount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              )}
              <VaultScene
                netMinor={Math.round(amount * 100)}
                visible={visible}
              />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
