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
const cylinder = require("../assets/vault/gold-cylinder-natural.png");
const cylinderBounds = [124, 116, 1936, 692] as const;
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
  const isCylinder = index === 6;
  const [left, top, right, bottom] = isCylinder
    ? cylinderBounds
    : bounds[index];
  const scale = width / (right - left);
  const size = 512 * scale;
  const sx = x - left * scale;
  const sy = baseline - bottom * scale;
  const cellId = `cell${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <G transform={`rotate(${rotation} ${x + width / 2} ${baseline})`}>
      <Defs>
        <ClipPath id={cellId}>
          <Rect
            x={isCylinder ? x : sx}
            y={isCylinder ? baseline - (bottom - top) * scale : sy}
            width={isCylinder ? width : size}
            height={isCylinder ? (bottom - top) * scale : size}
          />
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
            href={isCylinder ? cylinder : atlas}
            x={isCylinder ? sx : sx - (index % 3) * size}
            y={isCylinder ? sy : sy - Math.floor(index / 3) * size}
            width={isCylinder ? 2061 * scale : size * 3}
            height={isCylinder ? 763 * scale : size * 2}
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

export function VaultScene({
  netMinor,
  visible,
}: {
  netMinor: number;
  visible: boolean;
}) {
  const model = vaultPresentation(netMinor, visible);
  const id = `vault${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!model) return <ClosedVault />;
  const {
    x,
    y,
    w,
    h,
    tier,
    shownBars: count,
    rods,
    coins,
    grains,
    dust,
  } = model;
  const left = x + w * 0.222,
    right = x + w * 0.766,
    width = right - left,
    floor = y + h * 0.728;
  const cols = Math.min(model.cols, count),
    rows = cols ? Math.ceil(count / cols) : 0;
  const hasSmall = coins + grains + dust > 0;
  // Heavy ingots always rest at the bottom. Each lighter group gets a
  // supported shelf above the full height of the group beneath it.
  const barBase = floor - 1;
  const barSize = 34;
  const barHeight = rows ? (188 / 432) * barSize + (rows - 1) * 8.5 : 0;
  const groupWidth = cols ? (cols - 1) * 26 + barSize : 0;
  const barLeft = left + (width - groupWidth) / 2;
  const rodSize = count ? 34 : 42;
  const rodUnitHeight =
    (rodSize * (cylinderBounds[3] - cylinderBounds[1])) /
    (cylinderBounds[2] - cylinderBounds[0]);
  const rodStep = rodSize * 0.86;
  const rodCols = Math.min(3, rods);
  const rodRows = rodCols ? Math.ceil(rods / rodCols) : 0;
  const rodRowStep = rodUnitHeight * 0.65;
  const rodHeight = rods ? rodUnitHeight + (rodRows - 1) * rodRowStep : 0;
  const rodWidth = rodCols ? (rodCols - 1) * rodStep + rodSize : 0;
  const rodLeft = left + (width - rodWidth) / 2;
  const rodBase = count ? barBase - barHeight - 12 : floor - 1;
  const smallBase = rods
    ? rodBase - rodHeight - 12
    : count
      ? barBase - barHeight - 12
      : floor;
  // Keep small savings close; ease back between CNY 1,000 and 10,000
  // rather than abruptly shrinking the whole scene at a denomination carry.
  const pullback = Math.min(
    1,
    Math.max(0, Math.log10(Math.max(1000, netMinor / 100)) - 3),
  );
  const coinSize = 24 - 6 * pullback;
  const grainSize = 14 - 5 * pullback;
  const coinStep = coinSize * 0.72;
  const grainStep = grainSize * 0.7;
  const coinWidth = coins ? (Math.min(3, coins) - 1) * coinStep + coinSize : 0;
  const grainWidth = grains
    ? (Math.min(3, grains) - 1) * grainStep + grainSize + (grains > 3 ? 2 : 0)
    : 0;
  const ratio = dust / 1000;
  const rx = 3.5 + ratio * 6;
  const ry = 1 + ratio * 2;
  const dustWidth = dust ? rx * 2 + 3 : 0;
  const frontGroups = [coinWidth, grainWidth, dustWidth].filter(
    (v) => v > 0,
  ).length;
  const frontWidth =
    coinWidth + grainWidth + dustWidth + Math.max(0, frontGroups - 1) * 7;
  const coinLeft = left + (width - frontWidth) / 2;
  const grainLeft = coinLeft + (coins ? coinWidth + 7 : 0);
  const cx = grainLeft + (grains ? grainWidth + 7 : 0) + dustWidth / 2;
  const cy = smallBase - 0.4;
  const trayWidth = Math.min(width + 8, Math.max(58, frontWidth + 20));
  const trayLeft = left + (width - trayWidth) / 2;
  const sceneWidth = w * 0.94 + (330 - w * 0.94) * pullback;
  const sceneLeft = (330 - sceneWidth) / 2;
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
          x={coinLeft + col * coinStep + [-0.15, 0.2, 0][col]}
          baseline={smallBase - 3 - row * 3.7}
          width={coinSize}
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
          aspectRatio: sceneWidth / (280 - model.crop),
          alignSelf: "center",
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`${sceneLeft} ${model.crop} ${sceneWidth} ${280 - model.crop}`}
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
            {Array.from({ length: count }, (_, i) => {
              const row = Math.floor(i / model.cols),
                col = i % model.cols;
              return (
                <Unit
                  key={`bar${i}`}
                  index={(row * 2 + col) % 3}
                  x={barLeft + col * 26 + [-0.35, 0.25, 0.05, -0.15][i % 4]}
                  baseline={barBase - row * 8.5}
                  width={barSize}
                  id={id}
                  rotation={[-0.6, 0.35, -0.15, 0.55][i % 4]}
                />
              );
            })}
            {rods > 0 && count > 0 && (
              <G>
                <Path
                  d={`M${left - 3} ${rodBase + 1}h${width + 6}v3h-${width + 6}Z`}
                  fill="#7f8a6e"
                />
                <Path
                  d={`M${left - 3} ${rodBase + 1}h${width + 6}`}
                  stroke="#d0d2bb"
                  strokeWidth={1}
                />
              </G>
            )}
            {Array.from({ length: rods }, (_, i) => (
              <Unit
                key={`rod${i}`}
                index={6}
                x={
                  rodLeft + (i % 3) * rodStep + (Math.floor(i / 3) % 2 ? 1 : 0)
                }
                baseline={rodBase - Math.floor(i / 3) * rodRowStep}
                width={rodSize}
                id={id}
              />
            ))}
            {hasSmall && (count > 0 || rods > 0) && (
              <G>
                <Path
                  d={`M${left - 3} ${smallBase + 10}h${width + 6}v3h-${width + 6}Z`}
                  fill="#7f8a6e"
                />
                <Path
                  d={`M${left - 3} ${smallBase + 10}h${width + 6}`}
                  stroke="#d0d2bb"
                  strokeWidth={1}
                />
              </G>
            )}
            {hasSmall && (
              <G>
                <Ellipse
                  cx={trayLeft + trayWidth / 2}
                  cy={smallBase + 8}
                  rx={trayWidth / 2 + 1}
                  ry={3}
                  fill={`url(#${id}-contact)`}
                />
                <Path
                  d={`M${trayLeft + 7} ${smallBase - 12}H${trayLeft + trayWidth - 7}Q${trayLeft + trayWidth - 2} ${smallBase - 12} ${trayLeft + trayWidth} ${smallBase + 3}Q${trayLeft + trayWidth} ${smallBase + 9} ${trayLeft + trayWidth - 8} ${smallBase + 9}H${trayLeft + 8}Q${trayLeft} ${smallBase + 9} ${trayLeft} ${smallBase + 3}Q${trayLeft + 2} ${smallBase - 12} ${trayLeft + 7} ${smallBase - 12}Z`}
                  fill="#e8e3d2"
                  stroke="#b9bda8"
                  strokeWidth={0.8}
                />
                <Path
                  d={`M${trayLeft + 8} ${smallBase - 10}H${trayLeft + trayWidth - 8}L${trayLeft + trayWidth - 4} ${smallBase + 3}Q${trayLeft + trayWidth / 2} ${smallBase + 7} ${trayLeft + 4} ${smallBase + 3}Z`}
                  fill="#b6bba3"
                  stroke="#f4efdf"
                  strokeWidth={0.6}
                />
              </G>
            )}
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
                x={
                  grainLeft +
                  (i % 3) * grainStep +
                  (Math.floor(i / 3) % 2 ? 2 : 0)
                }
                baseline={smallBase - 1 - Math.floor(i / 3) * grainSize * 0.34}
                width={grainSize}
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
      <Text
        style={[s.muted, { fontSize: 11, lineHeight: 18, textAlign: "center" }]}
      >
        金块 1 万 · 金条 1 千 · 金币 100 · 金粒 10 · 零头为金粉
      </Text>
      {model.note !== "" && (
        <Text style={[s.muted, { textAlign: "center" }]}>{model.note}</Text>
      )}
    </View>
  );
}
