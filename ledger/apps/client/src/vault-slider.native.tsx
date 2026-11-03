import React from "react";
import Slider from "@react-native-community/slider";
import { colors as c } from "./theme";

export interface VaultSliderProps {
  value: number;
  valueText: string;
  onValueChange: (value: number) => void;
}
export function VaultSlider({
  value,
  valueText,
  onValueChange,
}: VaultSliderProps) {
  return (
    <Slider
      accessibilityLabel="金库预览金额"
      accessibilityValue={{ text: valueText }}
      minimumValue={0}
      maximumValue={1}
      step={0.001}
      value={value}
      onValueChange={onValueChange}
      minimumTrackTintColor={c.brand}
      maximumTrackTintColor={c.line}
      thumbTintColor={c.brand}
      style={{ width: "100%", height: 44 }}
    />
  );
}
