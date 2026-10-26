import { useState } from "react";
import { Text, View } from "react-native";
import { addDays } from "../../core/domain";
import { contexts, dayKey } from "../../core/format";
import { useApp } from "../../state/app-provider";
import { Access, Action, Card, Chips, Page, Select, styles } from "../../components/ui";
import { DateTimeField } from "../../components/date-time";
import { GlucoseChart } from "../../components/chart";
import { MealCard, ReadingCard, RecordActions } from "../../components/records";
export default function History() {
  const app = useApp();
  return <HistoryContent key={`${app.activeProfile?.id}-${app.activeProfile?.timezone}`} />;
}
function HistoryContent() {
  const app = useApp(); const tz = app.activeProfile?.timezone || "Asia/Shanghai"; const today = dayKey(undefined, tz);
  const [start, setStart] = useState(addDays(today, -6)); const [end, setEnd] = useState(today); const [context, setContext] = useState("all"); const [kind, setKind] = useState("all"); const [limit, setLimit] = useState(100);
  const readings = app.readings.filter(reading => dayKey(reading.measuredAt, tz) >= start && dayKey(reading.measuredAt, tz) <= end && (context === "all" || reading.context === context));
  const meals = app.meals.filter(meal => dayKey(meal.startedAt, tz) >= start && dayKey(meal.startedAt, tz) <= end);
  const entries = [...(kind === "meals" ? [] : readings.map(reading => ({ kind: "reading" as const, time: reading.measuredAt, reading }))), ...(kind === "readings" ? [] : meals.map(meal => ({ kind: "meal" as const, time: meal.startedAt, meal })))].sort((a, b) => b.time.localeCompare(a.time));
  return <Page title="记录与趋势" eyebrow="YOUR EVERYDAY JOURNAL"><Access><RecordActions /><Card>
    <View style={styles.row}>{[7, 30].map(days => <Action key={days} title={`最近 ${days} 天`} kind="secondary" onPress={() => { setStart(addDays(today, 1 - days)); setEnd(today); setLimit(100); }} />)}</View>
    <DateTimeField label="起始日期" dateOnly value={start} onChange={next => { setStart(next); if (next > end) setEnd(next); }} /><DateTimeField label="结束日期" dateOnly value={end} onChange={next => { setEnd(next); if (next < start) setStart(next); }} />
    <Select label="测量场景筛选" value={context} onChange={setContext} options={[{ value: "all", label: "全部测量场景" }, ...Object.entries(contexts).map(([value, label]) => ({ value, label }))]} />
  </Card><Card><Text style={styles.heading}>实测血糖 · {readings.length} 次</Text>{app.activeProfile && <GlucoseChart readings={readings} start={start} end={end} profile={app.activeProfile} />}</Card>
    <Chips value={kind} onChange={setKind} options={[{ value: "all", label: "全部" }, { value: "readings", label: "血糖" }, { value: "meals", label: "饮食" }]} /><Text style={[styles.muted, { marginVertical: 12 }]}>{entries.length} 笔记录</Text>
    {entries.slice(0, limit).map(entry => entry.kind === "reading" ? <ReadingCard key={entry.reading.id} reading={entry.reading} /> : <MealCard key={entry.meal.id} meal={entry.meal} />)}
    {!entries.length && <Card><Text style={styles.text}>这段时间还没有记录，可以调整日期或补记一笔。</Text></Card>}{entries.length > limit && <Action title="显示更多记录" kind="secondary" onPress={() => setLimit(limit + 100)} />}
  </Access></Page>;
}
