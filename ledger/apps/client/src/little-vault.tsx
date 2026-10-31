import React, { useId } from "react";
import { Pressable, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Filter,
  FeColorMatrix,
  FeDropShadow,
} from "react-native-svg";
import { Text } from "./appearance";
import { useAssetPrivacyController } from "./asset-privacy";
import { colors as c, styles as s } from "./theme";
import { vaultPresentation } from "./vault-model";

const cabinets = [
  require("../assets/vault/safe-small.png"),
  require("../assets/vault/safe-reinforced.png"),
  require("../assets/vault/safe-vault.png"),
];
const atlas = require("../assets/vault/gold-natural-atlas.png");
const bounds = [
  [42, 188, 474, 376],
  [45, 189, 477, 376],
  [47, 189, 478, 377],
  [95, 166, 463, 329],
  [115, 100, 419, 356],
  [142, 130, 386, 328],
];
function Unit({
  index,
  x,
  baseline,
  width,
  id,
  rotation = 0,
}: {
  index: number;
  x: number;
  baseline: number;
  width: number;
  id: string;
  rotation?: number;
}) {
  const [left, , right, bottom] = bounds[index];
  const size = (width * 512) / (right - left);
  const sx = x - (left / 512) * size;
  const sy = baseline - (bottom / 512) * size;
  const cellId = `cell${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <G transform={`rotate(${rotation} ${x + width / 2} ${baseline})`}>
      <Defs>
        <ClipPath id={cellId}>
          <Rect x={sx} y={sy} width={size} height={size} />
        </ClipPath>
      </Defs>
      <Ellipse
        cx={x + width / 2 + 0.65}
        cy={baseline + 0.45}
        rx={width * 0.48}
        ry={index < 3 ? 0.9 : 0.65}
        fill={`url(#${id}-contact)`}
      />
      <G filter={`url(#${id}-gold)`}>
        {/* Android nested Svg does not apply the SVG x/y viewport origin.
            Position and clip the atlas in the parent canvas on every platform. */}
        <G clipPath={`url(#${cellId})`}>
          <Image
            href={atlas}
            x={sx - (index % 3) * size}
            y={sy - Math.floor(index / 3) * size}
            width={size * 3}
            height={size * 2}
          />
        </G>
      </G>
    </G>
  );
}
function ClosedVault() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="小金库已合上，金库内容已隐藏"
      style={{ width: "100%", maxWidth: 330, height: 150, alignSelf: "center" }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 330 150" accessible={false}>
        <Rect x={100} y={18} width={130} height={110} rx={14} fill="#e9e5d8" />
        <Rect x={109} y={27} width={112} height={92} rx={9} fill="#bac0ab" />
        <Rect x={115} y={33} width={100} height={80} rx={6} fill="#d5d9c9" />
        <Circle cx={165} cy={73} r={17} fill="#89977f" />
        <Circle cx={165} cy={73} r={10} fill="#c7ceb9" />
        <Path
          d="M165 57v32M149 73h32"
          stroke="#6f8066"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Rect x={112} y={128} width={17} height={5} rx={2} fill="#89977f" />
        <Rect x={201} y={128} width={17} height={5} rx={2} fill="#89977f" />
      </Svg>
    </View>
  );
}

export function LittleVault({ netMinor }: { netMinor: number }) {
  // Mounted only on Assets. Separate session state from numeric asset privacy.
  const privacy = useAssetPrivacyController(true);
  const Icon = privacy.visible ? Eye : EyeOff;
  return (
    <View style={{ gap: 6 }}>
      <View style={s.between}>
        <Text style={s.muted}>小金库</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={privacy.visible ? "隐藏金库内容" : "显示金库内容"}
          accessibilityState={{ selected: privacy.visible }}
          accessibilityHint="独立于金额显示，离开资产页或进入后台自动收起"
          hitSlop={8}
          onPress={privacy.toggle}
          style={s.assetEye}
        >
          <Icon size={21} color={privacy.visible ? c.brand : c.muted} />
        </Pressable>
      </View>
      <VaultScene netMinor={netMinor} visible={privacy.visible} />
    </View>
  );
}

function VaultScene({
  netMinor,
  visible,
}: {
  netMinor: number;
  visible: boolean;
}) {
  const model = vaultPresentation(netMinor, visible);
  const id = `vault${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!model) return <ClosedVault />;
  const { x, y, w, h, tier, shownBars: count, coins, grains, dust } = model;
  const left = x + w * 0.222,
    right = x + w * 0.766,
    width = right - left,
    floor = y + h * 0.728;
  const cols = Math.min(model.cols, count),
    rows = cols ? Math.ceil(count / cols) : 0;
  const barBase = floor - (tier > 0 ? 34 : 14),
    groupWidth = cols ? (cols - 1) * 24 + 26 : 0;
  const barLeft =
    tier > 0
      ? left + (width - groupWidth) / 2
      : Math.max(
          left + 3,
          left + (width - groupWidth - (coins ? 18 : 0)) / 2 - 3,
        );
  const coinWidth = coins ? (Math.min(3, coins) - 1) * 11.5 + 14 : 0;
  const coinLeft =
    tier === 0 && model.bars
      ? Math.min(right - coinWidth - 3, barLeft + groupWidth - 4)
      : model.bars
        ? right - coinWidth - 3
        : left + (width - coinWidth) / 2;
  const grainLeft = model.bars
    ? tier === 0
      ? barLeft - 4
      : left + 7
    : coins
      ? coinLeft - 12
      : left + width * 0.37;
  const ratio = dust / 10000,
    rx = 3 + ratio * 12,
    ry = 0.8 + ratio * 2.8;
  const cx = grains
      ? grainLeft + 21
      : coins
        ? coinLeft - 9
        : left + width * 0.5,
    cy = floor - 0.4;
  const grainPositions = [
    [0, 0],
    [7, -1],
    [3, -5],
    [10, -6],
    [-3, -3],
    [12, -2],
    [5, -8],
    [15, -5],
    [1, -9],
  ];
  const coinUnits = Array.from({ length: coins }, (_, i) => {
    const row = Math.floor(i / 3),
      col = i % 3,
      pose = coins > 1 && i === Math.min(2, coins - 1) ? 4 : 3;
    return {
      i,
      pose,
      node: (
        <Unit
          key={`coin${i}`}
          index={pose}
          x={coinLeft + col * 11.5 + [-0.15, 0.2, 0][col]}
          baseline={floor - 3 - row * 3.7}
          width={pose === 4 ? 13 : 14}
          id={id}
          rotation={[-1, 0.6, -0.3][col]}
        />
      ),
    };
  });
  return (
    <View style={{ gap: 6 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${model.name}；${model.description}${model.note ? `；${model.note}` : ""}`}
        style={{
          width: "100%",
          maxWidth: 330,
          aspectRatio: 330 / (280 - model.crop),
          alignSelf: "center",
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 ${model.crop} 330 ${280 - model.crop}`}
          accessible={false}
        >
          <Defs>
            <RadialGradient id={`${id}-contact`}>
              <Stop stopColor="#26301e" stopOpacity={0.42} />
              <Stop offset="1" stopColor="#26301e" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`${id}-powder`}>
              <Stop stopColor="#bd9851" stopOpacity={0.58} />
              <Stop offset="1" stopColor="#a18443" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${id}-room`} x1="0" y1="0" x2="1" y2="1">
              <Stop stopColor="#cad0b8" stopOpacity={0} />
              <Stop offset="1" stopColor="#223525" stopOpacity={0.035} />
            </LinearGradient>
            <Filter
              id={`${id}-gold`}
              x="-20%"
              y="-25%"
              width="145%"
              height="160%"
            >
              <FeColorMatrix type="saturate" values=".94" />
              <FeDropShadow
                dx=".55"
                dy=".55"
                stdDeviation=".32"
                floodColor="#25311f"
                floodOpacity={0.24}
              />
            </Filter>
            <ClipPath id={`${id}-inside`}>
              <Rect
                x={x + w * 0.17}
                y={y + h * 0.25}
                width={w * 0.64}
                height={h * 0.52}
                rx={w * 0.025}
              />
            </ClipPath>
          </Defs>
          <Image href={cabinets[tier]} x={x} y={y} width={w} height={h} />
          <G clipPath={`url(#${id}-inside)`}>
            {tier > 0 &&
              count > 0 &&
              Array.from({ length: Math.ceil(rows / 3) }, (_, i) => {
                const sy = barBase - i * 38 + 0.8;
                return (
                  <G key={`shelf${i}`}>
                    <Path
                      d={`M${left - 3} ${sy + 4}h${width + 6}v3h-${width + 6}Z`}
                      fill="#35422d"
                      opacity={0.12}
                    />
                    <Path
                      d={`M${left - 2} ${sy + 2.5}l3-2.5h${width - 2}l3 2.5Z`}
                      fill="#a8b093"
                    />
                    <Path
                      d={`M${left - 2} ${sy + 2.5}h${width + 4}v2.2h-${width + 4}Z`}
                      fill="#7f8a6e"
                    />
                    <Path
                      d={`M${left - 2} ${sy + 2.5}h${width + 4}`}
                      stroke="#c3c9b1"
                      strokeWidth={0.55}
                    />
                  </G>
                );
              })}
            {Array.from({ length: count }, (_, i) => {
              const row = Math.floor(i / model.cols),
                col = i % model.cols;
              return (
                <Unit
                  key={`bar${i}`}
                  index={(row * 2 + col) % 3}
                  x={barLeft + col * 24 + [-0.35, 0.25, 0.05, -0.15][i % 4]}
                  baseline={
                    barBase - Math.floor(row / 3) * 38 - (row % 3) * 10.4
                  }
                  width={26}
                  id={id}
                  rotation={[-0.6, 0.35, -0.15, 0.55][i % 4]}
                />
              );
            })}
            {coinUnits
              .filter((unit) => unit.pose === 3)
              .map((unit) => unit.node)}
            {coinUnits
              .filter((unit) => unit.pose === 4)
              .map((unit) => unit.node)}
            {Array.from({ length: grains }, (_, i) => (
              <Unit
                key={`grain${i}`}
                index={5}
                x={grainLeft + grainPositions[i][0]}
                baseline={floor - 1 + grainPositions[i][1]}
                width={8}
                id={id}
                rotation={[-4, 2, -1, 3][i % 4]}
              />
            ))}
            {dust > 0 && (
              <G>
                <Ellipse
                  cx={cx + 1}
                  cy={cy + 0.5}
                  rx={rx + 2}
                  ry={ry + 1}
                  fill={`url(#${id}-powder)`}
                />
                <Path
                  d={`M${cx - rx} ${cy}Q${cx - 2} ${cy - ry * 1.4} ${cx + rx} ${cy}Q${cx + 3} ${cy + ry} ${cx - rx} ${cy}Z`}
                  fill="#c9a95d"
                  opacity={0.56}
                />
                {Array.from({ length: Math.ceil(ratio * 40) }, (_, i) => {
                  const a = i * 2.39996,
                    r = Math.sqrt((i + 0.3) / Math.ceil(ratio * 40));
                  return (
                    <Circle
                      key={i}
                      cx={cx + Math.cos(a) * r * rx}
                      cy={cy + Math.sin(a) * r * ry}
                      r={[0.38, 0.52, 0.32, 0.7][i % 4]}
                      fill={["#dec17a", "#ad853d", "#e4ce94", "#b9954d"][i % 4]}
                    />
                  );
                })}
              </G>
            )}
            <Rect
              x={left - 5}
              y={y + h * 0.28}
              width={width + 10}
              height={h * 0.46}
              fill={`url(#${id}-room)`}
            />
          </G>
        </Svg>
      </View>
      <Text style={[s.muted, { textAlign: "center" }]}>
        {model.name} · 小金库
      </Text>
      <Text style={[s.muted, { textAlign: "center" }]}>
        {model.description}
      </Text>
      {model.note !== "" && (
        <Text style={[s.muted, { textAlign: "center" }]}>{model.note}</Text>
      )}
    </View>
  );
}
