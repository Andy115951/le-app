import React from "react";
import Svg, { Path } from "react-native-svg";
import { colors } from "./theme";
import {
  defaultLabelIcon,
  type Label,
  type LabelIcon,
  type AccountKind,
} from "@ledger/core";

// Small bundled vectors used by labels on every client. No downloads or icon fonts.
const paths: Record<LabelIcon | "bank" | "cash" | "card" | "leaf", string> = {
  tag: "M3 4h8l10 10-7 7L3 10Z M7 8h.01",
  food: "M6 3v7 M3 3v4a3 3 0 0 0 6 0V3 M6 10v11 M17 3c-3 4-3 9 1 9h1V3Z M19 12v9",
  coffee:
    "M4 8h12v7a5 5 0 0 1-10 0V8 M16 9h2a3 3 0 0 1 0 6h-2 M3 21h16 M8 3v2 M12 3v2",
  train:
    "M8 3h8a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z M5 11h14 M8 21l2-3 M16 21l-2-3 M9 14h.01 M15 14h.01",
  shopping: "M5 7h14l2 14H3Z M9 8V6a3 3 0 0 1 6 0v2",
  home: "M3 10 12 3l9 7v10H3Z M9 20v-7h6v7",
  salary: "M4 6h16v14H4Z M8 6V3h8v3 M4 11h16 M10 11v3h4v-3",
  investment: "M4 20V9 M10 20V4 M16 20v-7 M21 20H2",
  gift: "M3 8h18v5H3Z M5 13v8h14v-8 M12 8v13 M12 8C3 8 5 0 9 4Z M12 8c9 0 7-8 3-4Z",
  health: "M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z",
  sport: "M3 7v10 M7 4v16 M17 4v16 M21 7v10 M7 12h10",
  entertainment:
    "M7 7h10l4 11h-6l-3-3-3 3H3Z M7 10v4 M5 12h4 M16 11h.01 M18 14h.01",
  travel: "M8 6h8v15H8Z M8 6V3h8v3 M8 8H5v11h3 M16 8h3v11h-3",
  education: "M3 4h6l3 3 3-3h6v16h-6l-3 2-3-2H3Z M12 7v15",
  pets: "M6 4c-3 0-3 5 0 5s3-5 0-5Z M17 4c-3 0-3 5 0 5s3-5 0-5Z M3 11c-2 0-2 4 0 4s2-4 0-4Z M21 11c-2 0-2 4 0 4s2-4 0-4Z M6 18c0-7 12-7 12 0s-4 2-6 2-6 3-6-2Z",
  bank: "M3 8l9-5 9 5Z M4 21h16 M6 11v6 M12 11v6 M18 11v6",
  cash: "M3 6h18v13H3Z M9 12.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M6 10h.01 M18 15h.01",
  card: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M3 10h18 M7 15h3",
  leaf: "M5 20c5-4 10-9 14-17 M7 16C1 15 2 8 6 10s4 4 1 6Z M13 10c0-6 7-9 7-5s-3 7-7 5Z",
};
export const iconNames: Record<LabelIcon, string> = {
  tag: "通用",
  food: "餐饮",
  coffee: "咖啡",
  train: "交通",
  shopping: "购物",
  home: "住房",
  salary: "工资",
  investment: "理财",
  gift: "礼物",
  health: "医疗",
  sport: "运动",
  entertainment: "娱乐",
  travel: "旅行",
  education: "学习",
  pets: "宠物",
};
export function SmallIcon({
  name,
  size = 22,
  color = colors.muted,
}: {
  name: keyof typeof paths;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={paths[name] || paths.tag}
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
export function LabelGlyph({
  label,
  size = 22,
  color,
}: {
  label?: Label;
  size?: number;
  color?: string;
}) {
  return (
    <SmallIcon
      name={
        label
          ? label.icon || defaultLabelIcon(label.name, label.direction)
          : "tag"
      }
      size={size}
      color={color}
    />
  );
}
export function AccountGlyph({
  kind,
  size = 22,
}: {
  kind: AccountKind;
  size?: number;
}) {
  return (
    <SmallIcon
      name={
        kind === "credit"
          ? "card"
          : kind === "investment"
            ? "investment"
            : "bank"
      }
      size={size}
    />
  );
}
