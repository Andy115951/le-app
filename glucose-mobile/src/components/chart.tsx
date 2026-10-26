import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { localDateTimeToIso, type Profile, type Reading } from "../core/domain";
import { contexts, displayValue, timeLabel } from "../core/format";
import { styles } from "./ui";
export function GlucoseChart({ readings, start, end, profile }: { readings: Reading[]; start: string; end: string; profile: Profile }) {
  const [selected, setSelected] = useState<Reading | null>(null);
  const points = readings.filter(reading => reading.standardValue !== null);
  if (!points.length) return <Text style={styles.muted}>这个范围还没有数值实测。HI / LO 保留在记录明细中。</Text>;
  const from = Date.parse(localDateTimeToIso(`${start}T00:00`, profile.timezone));
  const to = Date.parse(localDateTimeToIso(`${end}T23:59`, profile.timezone));
  const value = (reading: Reading) => reading.standardValue! * (profile.unit === "mg/dL" ? 18 : 1);
  const maximum = Math.max(profile.unit === "mg/dL" ? 180 : 10, ...points.map(value)) * 1.1;
  return <View><Svg accessibilityLabel={`${start}至${end}，${points.length}个血糖实测点，${profile.unit}`} width="100%" height={200} viewBox="0 0 340 200">
    {[0, 1, 2, 3].map(index => <ViewLine key={index} y={165 - index * 45} label={(index * maximum / 3).toFixed(profile.unit === "mg/dL" ? 0 : 1)} />)}
    {points.map(reading => <Circle key={reading.id} cx={35 + Math.max(0, Math.min(1, (Date.parse(reading.measuredAt) - from) / Math.max(1, to - from))) * 290} cy={165 - value(reading) / maximum * 135} r={5} fill="#70976a" opacity={.85} onPress={() => setSelected(reading)} />)}
    <SvgText x={35} y={190} fontSize={10} fill="#687c6c">{start.slice(5)}</SvgText><SvgText x={325} y={190} textAnchor="end" fontSize={10} fill="#687c6c">{end.slice(5)}</SvgText>
  </Svg>{selected && points.some(reading => reading.id === selected.id) && <Text style={styles.text}>{timeLabel(selected.measuredAt, profile.timezone, true)} · {contexts[selected.context]} · {displayValue(selected, profile.unit)} {profile.unit}</Text>}<Text style={styles.muted}>仅展示实测点；不同场景和餐后间隔请分别比较。</Text></View>;
}
function ViewLine({ y, label }: { y: number; label: string }) { return <><Line x1={35} x2={325} y1={y} y2={y} stroke="#e2e9df" /><SvgText x={28} y={y + 4} textAnchor="end" fill="#687c6c" fontSize={10}>{label}</SvgText></>; }
