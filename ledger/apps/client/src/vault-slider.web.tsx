import React from "react";
import type { VaultSliderProps } from "./vault-slider.native";
import { colors as c } from "./theme";

// A browser range input supplies keyboard, touch and pointer behavior in Tauri.
export function VaultSlider({
  value,
  valueText,
  onValueChange,
}: VaultSliderProps) {
  return (
    <input
      type="range"
      aria-label="金库预览金额"
      aria-valuetext={valueText}
      min={0}
      max={1}
      step={0.001}
      value={value}
      onChange={(event) => onValueChange(Number(event.currentTarget.value))}
      style={{
        display: "block",
        width: "100%",
        height: 44,
        margin: 0,
        accentColor: c.brand,
        cursor: "pointer",
      }}
    />
  );
}
