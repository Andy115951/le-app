import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { buildDashboardBuckets } from "./statistics";
import { Icon, type IconName } from "./Icon";

type Locale = "zh" | "en";
type Theme = "light" | "dark";

type ActivityEntry = {
  id: number;
  app_name: string;
  window_title: string;
  bundle_id: string | null;
  activity_type: string | null;
  entity_name: string | null;
  detail: string | null;
  workspace: string | null;
  file_name: string | null;
  domain: string | null;
  project: string | null;
  tag: string | null;
  source: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
};

type ActiveWindow = {
  app_name: string;
  window_title: string;
  bundle_id: string | null;
  activity_type: string | null;
  entity_name: string | null;
  detail: string | null;
  workspace: string | null;
  file_name: string | null;
  domain: string | null;
  captured_at: string;
};

type RuntimeStatus = {
  tracking_enabled: boolean;
  interval_ms: number;
  last_active: ActiveWindow | null;
  last_warning: string | null;
};

type RuleRow = {
  id: number;
  name: string;
  app_pattern: string;
  title_pattern: string;
  project: string | null;
  tag: string | null;
  enabled: boolean;
  priority: number;
  created_at: string;
};

type RuleForm = {
  name: string;
  app_pattern: string;
  title_pattern: string;
  project: string;
  tag: string;
  priority: number;
};

type RuleSuggestions = {
  app_names: string[];
};

type DailySummary = {
  day_key: string;
  total_seconds: number;
  uncategorized_seconds: number;
  running_seconds: number;
  top_app: string | null;
  top_project: string | null;
  top_tag: string | null;
  entry_count: number;
  coverage: number;
  focus_minutes: number;
};

type ViewMode = "overview" | "dashboard" | "daily" | "charts" | "rules" | "timeline";
type ChartGroup = "project" | "app";

type ChartSlice = {
  name: string;
  sec: number;
  ratio: number;
  color: string;
};

type TrendDay = {
  key: string;
  label: string;
  totalSec: number;
  segments: Array<{
    name: string;
    sec: number;
    ratio: number;
    color: string;
  }>;
};

type HoverTip = {
  text: string;
  x: number;
  y: number;
};

type EntryWindow = {
  startSec: number;
  endSec: number;
};

type Dict = Record<string, string>;

const LOCALE_KEY = "timing-lite-locale";
const DETAIL_MODE_KEY = "timing-lite-detail-mode";
const HIDE_EMPTY_BUCKETS_KEY = "timing-lite-hide-empty-buckets";
const THEME_KEY = "timing-lite-theme";
const NAVIGATION: Array<{ view: ViewMode; label: string; icon: IconName }> = [
  { view: "overview", label: "viewOverview", icon: "overview" },
  { view: "dashboard", label: "viewDashboard", icon: "dashboard" },
  { view: "daily", label: "viewDaily", icon: "calendar" },
  { view: "charts", label: "viewCharts", icon: "chart" },
  { view: "timeline", label: "viewTimeline", icon: "list" },
  { view: "rules", label: "viewRules", icon: "rules" },
];

const I18N: Record<Locale, Dict> = {
  zh: {
    workspace: "我的工作台",
    navigation: "时间与活动",
    preferences: "偏好设置",
    recording: "正在记录",
    paused: "记录已暂停",
    localOnly: "数据仅保存在本机",
    storageSummary: "30 天明细 · 1 年汇总",
    storagePolicy: "数据库约 50 MiB 软上限；超限会优先清理最早的历史记录。",
    lightTheme: "切换到浅色模式",
    darkTheme: "切换到深色模式",
    overviewHeading: "今日概览",
    dashboardHeading: "统计看板",
    dailyHeading: "每日回顾",
    chartsHeading: "图表分析",
    timelineHeading: "活动列表",
    rulesHeading: "分类规则",
    overviewDescription: "查看当前活动和今日使用时长。",
    dashboardDescription: "按时间范围查看使用时长、趋势和分类统计。",
    dailyDescription: "按日期查看使用时长和活动记录。",
    chartsDescription: "查看项目、标签和应用的时间分布。",
    timelineDescription: "搜索和查看最近的活动记录。",
    rulesDescription: "根据应用名称或窗口标题自动分类。",
    ruleHint: "按应用或窗口标题匹配；优先级数字越小，越先应用。",
    hourDistribution: "一天中的投入",
    metrics: "今日数据",
    emptyHint: "记录会在你使用电脑时自动出现。",
    rulesEmptyHint: "添加第一条规则，让时间记录自动归类。",
    timelineHint: "显示最近 1,000 条记录",
    noSearchResults: "没有找到匹配的活动",
    searchEmptyHint: "换个关键词，再找找看。",
    loadingActivity: "正在读取本地记录…",
    title: "Timing Lite",
    subtitle: "后台记录 + 自动分类规则",
    backgroundHint: "关闭窗口后，记录仍在后台继续。",
    view: "视图",
    viewOverview: "概览",
    viewDashboard: "统计看板",
    viewDaily: "每日",
    viewCharts: "图表分析",
    viewRules: "规则管理",
    viewTimeline: "活动列表",
    language: "语言",
    detailMode: "详细显示",
    hideEmptyBuckets: "隐藏 0 小时时段",
    tracking: "采集开关",
    interval: "采集间隔",
    captureNow: "立即采集",
    dayOverview: "今日总览",
    allInOneScreen: "今日一览",
    current: "当前活动",
    noActive: "暂无活动窗口",
    statsDashboard: "统计看板",
    todayTotal: "今日总时长",
    dayTotal: "当天总时长",
    rangeTotal: "所选范围总时长",
    runningSegments: "运行中时长",
    uncategorized: "未分类时长",
    ruleCoverage: "规则覆盖率",
    range: "看板范围",
    recent6h: "最近 6 小时",
    recent24h: "最近 1 天",
    recent7d: "最近 1 周",
    recent14d: "最近 2 周",
    recent30d: "最近 1 个月",
    trend: "趋势",
    dailyBoard: "每日看板",
    dailyBoardHint: "按天回看最近 7 / 14 / 30 天的使用情况",
    selectDayHint: "点击左侧日期卡片查看当天总结",
    dailySummary: "每日总结",
    selectedDayUsage: "当天使用情况",
    dailyHighlights: "高频活动",
    entriesCaptured: "记录片段",
    calendarEmpty: "这几天还没有可展示的记录",
    charts: "图表分析",
    chartsRangeHint: "用饼图快速看时间分布",
    dailyTrend: "最近 7 天趋势",
    trendHint: "按天看时间投入，并支持按项目或应用进程分类",
    groupBy: "分类方式",
    groupByProject: "按项目",
    groupByApp: "按应用进程",
    otherGroup: "其他",
    topProjects: "项目排行",
    topTags: "标签排行",
    noProjectData: "暂无项目数据",
    noTagData: "暂无标签数据",
    topApps: "应用排行",
    noAppData: "暂无应用数据",
    topProjectApp: "项目 / 应用排行（全量）",
    topContexts: "主要活动",
    rules: "规则管理",
    refreshRules: "刷新规则",
    ruleName: "规则名",
    appContains: "应用名包含（可选）",
    appSuggestHint: "可直接点历史应用名填入",
    titleContains: "窗口标题包含（可选）",
    project: "项目",
    tag: "标签",
    priority: "优先级",
    addRule: "新增规则",
    rulePatternRequired: "至少填写应用名包含或窗口标题包含其中一个",
    pattern: "匹配",
    projectTag: "项目 / 标签",
    status: "状态",
    action: "操作",
    enabled: "启用",
    disabled: "禁用",
    disable: "停用",
    enable: "启用",
    delete: "删除",
    noRules: "还没有规则",
    timeline: "活动列表",
    listSearch: "列表搜索（应用/上下文/窗口/项目/标签）",
    app: "应用",
    activityType: "类型",
    context: "上下文",
    window: "窗口",
    originalWindow: "原始窗口标题",
    detailLabel: "细节",
    workspaceLabel: "工作区",
    fileLabel: "文件",
    domainLabel: "站点",
    source: "来源",
    start: "开始",
    end: "结束",
    duration: "时长",
    running: "进行中",
    noData: "暂无记录",
    pageSize: "每页",
    page: "页",
    prev: "上一页",
    next: "下一页",
    total: "总计",
    records: "条",
    focusMinutes: "记录分钟",
    dayFocusMinutes: "记录分钟",
    topProjectLabel: "主要项目",
    topAppLabel: "主要应用",
    topTagLabel: "主要标签",
    unknown: "未知",
    uncategorizedTag: "未分类",
    defaultSource: "默认",
    typeCoding: "编码",
    typeBrowser: "浏览",
    typeDocs: "文档",
    typeTerminal: "终端",
    typeChat: "沟通",
    typeMeeting: "会议",
    typeDesign: "设计",
    typeFiles: "文件",
    typeAi: "AI",
    noContext: "暂无结构化上下文",
    summarySentenceIdle: "这一天暂时没有记录到明显的使用活动。",
    summarySentenceActive: "这一天共记录 {duration}，主要在 {project} 上，最常用应用是 {app}。"
  },
  en: {
    workspace: "My workspace",
    navigation: "TIME & ACTIVITY",
    preferences: "Preferences",
    recording: "Tracking activity",
    paused: "Tracking paused",
    localOnly: "Stored on this device",
    storageSummary: "30-day details · 1-year summaries",
    storagePolicy: "A 50 MiB soft database budget; the oldest history is cleared first when exceeded.",
    lightTheme: "Switch to light mode",
    darkTheme: "Switch to dark mode",
    overviewHeading: "Today’s overview",
    dashboardHeading: "Statistics",
    dailyHeading: "Daily review",
    chartsHeading: "Charts",
    timelineHeading: "Activity list",
    rulesHeading: "Classification rules",
    overviewDescription: "Current activity and today’s tracked time.",
    dashboardDescription: "Tracked time, trends, and categories for the selected range.",
    dailyDescription: "View tracked time and activities by date.",
    chartsDescription: "Time distribution by project, tag, and app.",
    timelineDescription: "Search and review recent activity records.",
    rulesDescription: "Classify activities by app name or window title.",
    ruleHint: "Match an app or window title. Lower priority numbers are applied first.",
    hourDistribution: "Your daily rhythm",
    metrics: "Today in numbers",
    emptyHint: "Your activity will appear here as you use your computer.",
    rulesEmptyHint: "Add your first rule to start organizing your time automatically.",
    timelineHint: "Showing the latest 1,000 entries",
    noSearchResults: "No matching activities",
    searchEmptyHint: "Try a different keyword.",
    loadingActivity: "Loading local activity…",
    title: "Timing Lite",
    subtitle: "Background tracking + auto classify rules",
    backgroundHint: "Closing the window now keeps tracking in the background, and locked, sleep, or shutdown time is ignored.",
    view: "View",
    viewOverview: "Overview",
    viewDashboard: "Dashboard",
    viewDaily: "Daily",
    viewCharts: "Charts",
    viewRules: "Rules",
    viewTimeline: "Timeline",
    language: "Language",
    detailMode: "Detailed View",
    hideEmptyBuckets: "Hide Zero-Hour Buckets",
    tracking: "Tracking",
    interval: "Interval",
    captureNow: "Capture now",
    dayOverview: "Today Overview",
    allInOneScreen: "Your day at a glance",
    current: "Current",
    noActive: "No active window",
    statsDashboard: "Stats Dashboard",
    todayTotal: "Today Total",
    dayTotal: "Day Total",
    rangeTotal: "Selected Range Total",
    runningSegments: "Running Segments",
    uncategorized: "Uncategorized",
    ruleCoverage: "Rule Coverage",
    range: "Range",
    recent6h: "Last 6 Hours",
    recent24h: "Last 1 Day",
    recent7d: "Last 1 Week",
    recent14d: "Last 2 Weeks",
    recent30d: "Last 1 Month",
    trend: "Trend",
    dailyBoard: "Daily Board",
    dailyBoardHint: "Review usage by day for the last 7, 14, or 30 days",
    selectDayHint: "Click a day card on the left to inspect that day",
    dailySummary: "Daily Summary",
    selectedDayUsage: "Day Usage",
    dailyHighlights: "Top Activities",
    entriesCaptured: "Captured Segments",
    calendarEmpty: "No recent daily activity to show",
    charts: "Charts",
    chartsRangeHint: "Use pie charts to see where time goes",
    dailyTrend: "Last 7 Days Trend",
    trendHint: "See daily time split by project or app process",
    groupBy: "Group By",
    groupByProject: "Project",
    groupByApp: "App Process",
    otherGroup: "Other",
    topProjects: "Top Projects",
    topTags: "Top Tags",
    noProjectData: "No project data yet",
    noTagData: "No tag data yet",
    topApps: "Top Apps",
    noAppData: "No app data yet",
    topProjectApp: "Top Project / App (All Data)",
    topContexts: "Top Activities",
    rules: "Rules",
    refreshRules: "Refresh Rules",
    ruleName: "Rule name",
    appContains: "App contains (optional)",
    appSuggestHint: "Click a historical app name to fill it",
    titleContains: "Window contains (optional)",
    project: "Project",
    tag: "Tag",
    priority: "Priority",
    addRule: "Add Rule",
    rulePatternRequired: "Fill in at least app contains or window contains",
    pattern: "Pattern",
    projectTag: "Project / Tag",
    status: "Status",
    action: "Action",
    enabled: "Enabled",
    disabled: "Disabled",
    disable: "Disable",
    enable: "Enable",
    delete: "Delete",
    noRules: "No rules yet",
    timeline: "Timeline",
    listSearch: "Search (app/context/window/project/tag)",
    app: "App",
    activityType: "Type",
    context: "Context",
    window: "Window",
    originalWindow: "Original Window Title",
    detailLabel: "Detail",
    workspaceLabel: "Workspace",
    fileLabel: "File",
    domainLabel: "Site",
    source: "Source",
    start: "Start",
    end: "End",
    duration: "Duration",
    running: "Running",
    noData: "No activity captured yet",
    pageSize: "Per page",
    page: "Page",
    prev: "Prev",
    next: "Next",
    total: "Total",
    records: "records",
    focusMinutes: "Tracked Minutes",
    dayFocusMinutes: "Tracked Minutes",
    topProjectLabel: "Top Project",
    topAppLabel: "Top App",
    topTagLabel: "Top Tag",
    unknown: "Unknown",
    uncategorizedTag: "Uncategorized",
    defaultSource: "default",
    typeCoding: "Coding",
    typeBrowser: "Browsing",
    typeDocs: "Docs",
    typeTerminal: "Terminal",
    typeChat: "Chat",
    typeMeeting: "Meeting",
    typeDesign: "Design",
    typeFiles: "Files",
    typeAi: "AI",
    noContext: "No structured context yet",
    summarySentenceIdle: "No meaningful activity was captured on this day.",
    summarySentenceActive: "{duration} was captured on this day, mostly on {project}, with {app} used the most."
  }
};

const DEFAULT_RULE_FORM: RuleForm = {
  name: "",
  app_pattern: "",
  title_pattern: "",
  project: "",
  tag: "",
  priority: 100
};

const CHART_COLORS = ["#59846b", "#a5bda3", "#d3b27b", "#8baab7", "#a493b0", "#cc9681", "#96a5a1"];

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function localizedActivityType(type: string | null, t: (key: string) => string): string {
  switch (type) {
    case "coding":
      return t("typeCoding");
    case "browser":
      return t("typeBrowser");
    case "docs":
      return t("typeDocs");
    case "terminal":
      return t("typeTerminal");
    case "chat":
      return t("typeChat");
    case "meeting":
      return t("typeMeeting");
    case "design":
      return t("typeDesign");
    case "files":
      return t("typeFiles");
    case "ai":
      return t("typeAi");
    default:
      return "-";
  }
}

function buildContextPrimary(row: Pick<ActivityEntry, "entity_name" | "detail" | "window_title">): string {
  return row.entity_name || row.detail || row.window_title || "";
}

function buildContextMeta(
  row: Pick<ActivityEntry, "detail" | "workspace" | "file_name" | "domain" | "window_title">,
  t: (key: string) => string
): string[] {
  const items = [
    row.detail ? `${t("detailLabel")}: ${row.detail}` : "",
    row.workspace ? `${t("workspaceLabel")}: ${row.workspace}` : "",
    row.file_name ? `${t("fileLabel")}: ${row.file_name}` : "",
    row.domain ? `${t("domainLabel")}: ${row.domain}` : "",
    row.window_title ? `${t("originalWindow")}: ${row.window_title}` : ""
  ].filter(Boolean);

  return Array.from(new Set(items));
}

function asDateText(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toEpochSecond(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

function startOfLocalDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getEntryWindow(row: ActivityEntry): EntryWindow | null {
  const started = parseDate(row.started_at);
  if (!started) return null;

  const startSec = toEpochSecond(started);
  const durationSec = Math.max(0, Math.floor(row.duration_seconds));
  return {
    startSec,
    endSec: startSec + durationSec
  };
}

function overlapSeconds(window: EntryWindow, startSec: number, endSec: number): number {
  return Math.max(0, Math.min(window.endSec, endSec) - Math.max(window.startSec, startSec));
}

function allocateEntryToBuckets(
  row: ActivityEntry,
  bucketStartSec: number,
  bucketSizeSec: number,
  bucketCount: number,
  onBucket: (bucketIndex: number, sec: number) => void
) {
  const window = getEntryWindow(row);
  if (!window || window.endSec <= bucketStartSec) return;

  const allEndSec = bucketStartSec + bucketSizeSec * bucketCount;
  if (window.startSec >= allEndSec) return;

  let index = Math.max(0, Math.floor((window.startSec - bucketStartSec) / bucketSizeSec));

  while (index < bucketCount) {
    const currentStart = bucketStartSec + index * bucketSizeSec;
    const currentEnd = currentStart + bucketSizeSec;
    const sec = overlapSeconds(window, currentStart, currentEnd);
    if (sec > 0) onBucket(index, sec);
    if (currentEnd >= window.endSec) break;
    index += 1;
  }
}

function buildChartSlices(map: Map<string, number>, fallbackLabel: string): ChartSlice[] {
  const rows = Array.from(map.entries())
    .map(([name, sec]) => ({ name, sec }))
    .filter((item) => item.sec > 0)
    .sort((a, b) => b.sec - a.sec);

  const total = rows.reduce((sum, item) => sum + item.sec, 0);
  if (!total) return [];

  const top = rows.slice(0, 6);
  const restSec = rows.slice(6).reduce((sum, item) => sum + item.sec, 0);
  const combined = restSec > 0 ? [...top, { name: fallbackLabel, sec: restSec }] : top;

  return combined.map((item, index) => ({
    ...item,
    ratio: item.sec / total,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));
}

function describeRange(hours: number, t: (key: string) => string): string {
  if (hours === 6) return t("recent6h");
  if (hours === 24) return t("recent24h");
  return t("recent7d");
}

function describeDayWindow(days: number, t: (key: string) => string): string {
  if (days === 7) return t("recent7d");
  if (days === 14) return t("recent14d");
  return t("recent30d");
}

function formatDayLabel(dayKey: string, locale: Locale): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey.slice(5);
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric"
  }).format(d);
}

function formatWeekdayLabel(dayKey: string, locale: Locale): string {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    weekday: "short"
  }).format(d);
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}

function createArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function PieChart({
  slices,
  emptyText,
  totalLabel,
  onShowTip,
  onHideTip
}: {
  slices: ChartSlice[];
  emptyText: string;
  totalLabel: string;
  onShowTip: (event: ReactMouseEvent<Element>, text: string) => void;
  onHideTip: () => void;
}) {
  if (!slices.length) {
    return <div className="chart-empty"><div className="empty-ring" /><p className="muted">{emptyText}</p></div>;
  }

  let startAngle = 0;

  return (
    <div className="pie-chart-wrap">
      <svg viewBox="0 0 120 120" className="pie-chart" role="img" aria-label={slices.map((slice) => `${slice.name}: ${formatDuration(slice.sec)}`).join(", ")}>
        {slices.map((slice) => {
          const angle = Math.min(359.9999, slice.ratio * 360);
          const endAngle = startAngle + angle;
          const path = createArcPath(60, 60, 54, startAngle, endAngle);
          startAngle = endAngle;
          const tip = `${slice.name} · ${formatDuration(slice.sec)} · ${Math.round(slice.ratio * 100)}%`;
          return (
            <path
              key={slice.name}
              d={path}
              fill={slice.color}
              onMouseMove={(event) => onShowTip(event, tip)}
              onMouseLeave={onHideTip}
            />
          );
        })}
        <circle cx="60" cy="60" r="40" className="chart-center" />
        <text x="60" y="59" className="chart-total">{formatDuration(slices.reduce((sum, slice) => sum + slice.sec, 0))}</text>
        <text x="60" y="70" className="chart-total-label">{totalLabel}</text>
      </svg>
      <div className="pie-legend">
        {slices.map((slice) => (
          <div
            className="pie-legend-row"
            key={slice.name}
            onMouseMove={(event) =>
              onShowTip(
                event,
                `${slice.name} · ${formatDuration(slice.sec)} · ${Math.round(slice.ratio * 100)}%`
              )
            }
            onMouseLeave={onHideTip}
          >
            <span
              className="pie-dot"
              style={{ background: slice.color }}
            />
            <span className="pie-name">{slice.name}</span>
            <b>{Math.round(slice.ratio * 100)}%</b>
            <small>{formatDuration(slice.sec)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedTrendChart({
  days,
  emptyText,
  onShowTip,
  onHideTip
}: {
  days: TrendDay[];
  emptyText: string;
  onShowTip: (event: ReactMouseEvent<Element>, text: string) => void;
  onHideTip: () => void;
}) {
  const hasData = days.some((day) => day.totalSec > 0);
  if (!hasData) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="trend-days">
      {days.map((day) => (
        <div className="trend-day-row" key={day.key}>
          <div className="trend-day-meta">
            <span>{day.label}</span>
            <small>{formatDuration(day.totalSec)}</small>
          </div>
          <div className="trend-day-track">
            {day.segments.length ? (
              day.segments.map((segment) => (
                <div
                  key={`${day.key}-${segment.name}`}
                  className="trend-day-fill"
                  onMouseMove={(event) =>
                    onShowTip(event, `${day.label} · ${segment.name} · ${formatDuration(segment.sec)}`)
                  }
                  onMouseLeave={onHideTip}
                  style={{
                    width: `${segment.ratio * 100}%`,
                    background: segment.color
                  }}
                />
              ))
            ) : (
              <div className="trend-day-empty" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "zh");
  const [detailMode, setDetailMode] = useState(() => localStorage.getItem(DETAIL_MODE_KEY) === "true");
  const [hideEmptyBuckets, setHideEmptyBuckets] = useState(() => localStorage.getItem(HIDE_EMPTY_BUCKETS_KEY) !== "false");
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [statistics, setStatistics] = useState<{ rows: ActivityEntry[]; asOf: number }>({ rows: [], asOf: 0 });
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [ruleSuggestions, setRuleSuggestions] = useState<RuleSuggestions>({ app_names: [] });
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [dailyWindowDays, setDailyWindowDays] = useState<number>(14);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedDayEntries, setSelectedDayEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(DEFAULT_RULE_FORM);
  const [rangeHours, setRangeHours] = useState<number>(24);
  const [timelineQuery, setTimelineQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [chartGroup, setChartGroup] = useState<ChartGroup>("project");
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);
  const statisticsRequest = useRef(0);
  const selectedDayRequest = useRef(0);
  const dailySummariesRequest = useRef(0);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const selectedDayRef = useRef(selectedDayKey);
  selectedDayRef.current = selectedDayKey;
  const statisticsEntries = statistics.rows;

  const t = (key: string): string => I18N[locale][key] ?? key;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target) && settingsRef.current) {
        settingsRef.current.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settingsRef.current?.open) {
        settingsRef.current.open = false;
        settingsRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function refreshEntries() {
    const rows = await invoke<ActivityEntry[]>("list_entries", { limit: 1000 });
    setEntries(rows);
  }

  async function refreshStatistics() {
    const request = ++statisticsRequest.current;
    const asOf = toEpochSecond(new Date());
    const rows = await invoke<ActivityEntry[]>("list_entries_for_range", {
      startSec: asOf - 7 * 24 * 3600,
      endSec: asOf
    });
    if (request === statisticsRequest.current) setStatistics({ rows, asOf });
  }

  async function refreshRules() {
    const rows = await invoke<RuleRow[]>("list_rules");
    setRules(rows);
  }

  async function refreshRuleSuggestions() {
    const next = await invoke<RuleSuggestions>("list_rule_suggestions", { limit: 60 });
    setRuleSuggestions(next);
  }

  async function refreshDailySummaries(nextDays = dailyWindowDays) {
    const request = ++dailySummariesRequest.current;
    const rows = await invoke<DailySummary[]>("list_daily_summaries", { days: nextDays });
    if (request === dailySummariesRequest.current) setDailySummaries(rows);
  }

  async function refreshSelectedDay(dayKey: string) {
    if (dayKey !== selectedDayRef.current) return;
    const request = ++selectedDayRequest.current;
    const rows = await invoke<ActivityEntry[]>("list_entries_for_day", { dayKey });
    if (request === selectedDayRequest.current && dayKey === selectedDayRef.current) setSelectedDayEntries(rows);
  }

  async function refreshStatus() {
    const s = await invoke<RuntimeStatus>("get_runtime_status");
    setStatus(s);
    setWarning(s.last_warning);
  }

  async function refreshAll() {
    await Promise.all([
      refreshVisibleData(),
      refreshRules(),
      refreshRuleSuggestions(),
      refreshDailySummaries()
    ]);
  }

  async function refreshActivityData() {
    await Promise.all([
      refreshStatistics(),
      refreshEntries(),
      refreshDailySummaries(),
      ...(selectedDayKey ? [refreshSelectedDay(selectedDayKey)] : [])
    ]);
  }

  async function refreshVisibleData() {
    await Promise.all([
      refreshStatus(),
      ...(viewMode === "timeline" ? [refreshEntries()] : []),
      ...(["overview", "dashboard", "charts"].includes(viewMode) ? [refreshStatistics()] : []),
      ...(viewMode === "daily" ? [
        refreshDailySummaries(),
        ...(selectedDayKey ? [refreshSelectedDay(selectedDayKey)] : [])
      ] : [])
    ]);
  }

  const refreshVisibleRef = useRef(refreshVisibleData);
  refreshVisibleRef.current = refreshVisibleData;

  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem(DETAIL_MODE_KEY, String(detailMode));
  }, [detailMode]);

  useEffect(() => {
    localStorage.setItem(HIDE_EMPTY_BUCKETS_KEY, String(hideEmptyBuckets));
  }, [hideEmptyBuckets]);

  useEffect(() => {
    let canceled = false;
    let polling = false;
    (async () => {
      await invoke("init_db");
      if (canceled) return;
      await refreshAll();
      if (canceled) return;
      setLoading(false);
    })().catch((err) => {
      setWarning(String(err));
      setLoading(false);
    });

    const refresh = async () => {
      if (canceled || document.hidden || polling) return;
      polling = true;
      try {
        await refreshVisibleRef.current();
      } catch (err) {
        if (!canceled) setWarning(String(err));
      } finally {
        polling = false;
      }
    };
    const poll = window.setInterval(refresh, 3000);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      canceled = true;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (!dailySummaries.length) {
      setSelectedDayEntries([]);
      return;
    }
    if (!selectedDayKey || !dailySummaries.some((row) => row.day_key === selectedDayKey)) {
      setSelectedDayKey(dailySummaries[dailySummaries.length - 1].day_key);
    }
  }, [dailySummaries, selectedDayKey]);

  useEffect(() => {
    if (viewMode !== "daily" || !selectedDayKey) return;
    setSelectedDayEntries([]);
    refreshSelectedDay(selectedDayKey).catch((err) => setWarning(String(err)));
    return () => { selectedDayRequest.current += 1; };
  }, [selectedDayKey, viewMode]);

  useEffect(() => {
    if (loading) return;
    refreshVisibleRef.current().catch((err) => setWarning(String(err)));
  }, [viewMode, dailyWindowDays, loading]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (settingsRef.current) settingsRef.current.open = false;
  }, [viewMode]);

  useEffect(() => {
    const calendar = calendarRef.current;
    const selected = calendar?.querySelector<HTMLElement>(".day-card.active");
    if (!calendar || !selected) return;
    if (selected.offsetTop < calendar.scrollTop) calendar.scrollTop = selected.offsetTop;
    else if (selected.offsetTop + selected.offsetHeight > calendar.scrollTop + calendar.clientHeight) {
      calendar.scrollTop = selected.offsetTop + selected.offsetHeight - calendar.clientHeight + 4;
    }
  }, [viewMode, selectedDayKey, dailyWindowDays, dailySummaries.length]);

  const dashboard = useMemo(() => {
    const now = new Date(statistics.asOf * 1000);
    const rangeEndSec = toEpochSecond(now);
    const rangeStartSec = rangeEndSec - rangeHours * 3600;

    let totalSeconds = 0;
    let runningSeconds = 0;
    let uncategorizedSeconds = 0;

    const byTag = new Map<string, number>();
    const byProject = new Map<string, number>();
    const byApp = new Map<string, number>();

    for (const row of statisticsEntries) {
      const window = getEntryWindow(row);
      if (!window) continue;
      const sec = overlapSeconds(window, rangeStartSec, rangeEndSec);
      if (sec <= 0) continue;
      totalSeconds += sec;
      if (!row.ended_at) runningSeconds += sec;
      if (!row.project && !row.tag) uncategorizedSeconds += sec;

      const projectKey = row.project || row.app_name || t("unknown");
      byProject.set(projectKey, (byProject.get(projectKey) ?? 0) + sec);

      const tagKey = row.tag || t("uncategorizedTag");
      byTag.set(tagKey, (byTag.get(tagKey) ?? 0) + sec);

      const appKey = row.app_name || t("unknown");
      byApp.set(appKey, (byApp.get(appKey) ?? 0) + sec);
    }

    const topProjects = Array.from(byProject.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const topTags = Array.from(byTag.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const topApps = Array.from(byApp.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const buckets = buildDashboardBuckets(statisticsEntries, rangeStartSec, rangeEndSec, rangeHours <= 24);

    const maxBucketSec = Math.max(1, ...buckets.map((x) => x.sec));

    return {
      totalSeconds,
      runningSeconds,
      uncategorizedSeconds,
      topProjects,
      topTags,
      topApps,
      projectSlices: buildChartSlices(byProject, locale === "zh" ? "其他项目" : "Other Projects"),
      tagSlices: buildChartSlices(byTag, locale === "zh" ? "其他标签" : "Other Tags"),
      appSlices: buildChartSlices(byApp, locale === "zh" ? "其他应用" : "Other Apps"),
      buckets,
      maxBucketSec
    };
  }, [statistics, rangeHours, locale]);

  const dayOverview = useMemo(() => {
    const now = new Date(statistics.asOf * 1000);
    const todayStart = startOfLocalDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const todayStartSec = toEpochSecond(todayStart);
    const tomorrowStartSec = toEpochSecond(tomorrowStart);

    let totalSeconds = 0;
    let uncategorizedSeconds = 0;
    let runningSeconds = 0;

    const byProject = new Map<string, number>();
    const byTag = new Map<string, number>();
    const byApp = new Map<string, number>();
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sec: 0 }));

    for (const row of statisticsEntries) {
      const window = getEntryWindow(row);
      if (!window) continue;
      const sec = overlapSeconds(window, todayStartSec, tomorrowStartSec);
      if (sec <= 0) continue;
      totalSeconds += sec;
      if (!row.project && !row.tag) uncategorizedSeconds += sec;
      if (!row.ended_at) runningSeconds += sec;

      const app = row.app_name || t("unknown");
      const project = row.project || app;
      const tag = row.tag || t("uncategorizedTag");

      byApp.set(app, (byApp.get(app) ?? 0) + sec);
      byProject.set(project, (byProject.get(project) ?? 0) + sec);
      byTag.set(tag, (byTag.get(tag) ?? 0) + sec);
      allocateEntryToBuckets(row, todayStartSec, 3600, 24, (index, bucketSec) => {
        hourBuckets[index].sec += bucketSec;
      });
    }

    const topProjects = Array.from(byProject.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 4);
    const topTags = Array.from(byTag.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 4);
    const topApps = Array.from(byApp.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 4);

    const coverage = totalSeconds
      ? Math.max(
          0,
          Math.round(((totalSeconds - uncategorizedSeconds) / Math.max(1, totalSeconds)) * 100)
        )
      : 0;

    const focusMinutes = Math.round(totalSeconds / 60);
    const maxBucket = Math.max(1, ...hourBuckets.map((x) => x.sec));

    return {
      totalSeconds,
      runningSeconds,
      uncategorizedSeconds,
      topProjects,
      topTags,
      topApps,
      hourBuckets,
      maxBucket,
      coverage,
      focusMinutes
    };
  }, [statistics, locale]);

  const selectedDaySummary = useMemo(
    () => dailySummaries.find((row) => row.day_key === selectedDayKey) ?? null,
    [dailySummaries, selectedDayKey]
  );

  const selectedDayDetail = useMemo(() => {
    if (!selectedDayKey) return null;
    const dayStart = new Date(`${selectedDayKey}T00:00:00`);
    if (Number.isNaN(dayStart.getTime())) return null;
    const nextDay = new Date(dayStart);
    nextDay.setDate(dayStart.getDate() + 1);
    const dayStartSec = toEpochSecond(dayStart);
    const nextDaySec = toEpochSecond(nextDay);

    let totalSeconds = 0;
    let uncategorizedSeconds = 0;
    let runningSeconds = 0;

    const byProject = new Map<string, number>();
    const byTag = new Map<string, number>();
    const byApp = new Map<string, number>();
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sec: 0 }));

    for (const row of selectedDayEntries) {
      const window = getEntryWindow(row);
      if (!window) continue;
      const sec = overlapSeconds(window, dayStartSec, nextDaySec);
      if (sec <= 0) continue;

      totalSeconds += sec;
      if (!row.project && !row.tag) uncategorizedSeconds += sec;
      if (!row.ended_at) runningSeconds += sec;

      const app = row.app_name || t("unknown");
      const project = row.project || app;
      const tag = row.tag || t("uncategorizedTag");

      byApp.set(app, (byApp.get(app) ?? 0) + sec);
      byProject.set(project, (byProject.get(project) ?? 0) + sec);
      byTag.set(tag, (byTag.get(tag) ?? 0) + sec);
      allocateEntryToBuckets(row, dayStartSec, 3600, 24, (index, bucketSec) => {
        hourBuckets[index].sec += bucketSec;
      });
    }

    const topProjects = Array.from(byProject.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);
    const topTags = Array.from(byTag.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);
    const topApps = Array.from(byApp.entries())
      .map(([name, sec]) => ({ name, sec }))
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 5);

    const topContexts = selectedDayEntries
      .map((row) => {
        const window = getEntryWindow(row);
        const sec = window ? overlapSeconds(window, dayStartSec, nextDaySec) : 0;
        return {
          id: row.id,
          appName: row.app_name,
          contextPrimary: buildContextPrimary(row) || t("noContext"),
          startedAt: row.started_at,
          sec
        };
      })
      .filter((item) => item.sec > 0)
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 8);

    const coverage = totalSeconds
      ? Math.max(
          0,
          Math.round(((totalSeconds - uncategorizedSeconds) / Math.max(1, totalSeconds)) * 100)
        )
      : 0;

    return {
      totalSeconds,
      uncategorizedSeconds,
      runningSeconds,
      topProjects,
      topTags,
      topApps,
      topContexts,
      hourBuckets,
      maxBucket: Math.max(1, ...hourBuckets.map((x) => x.sec)),
      coverage,
      focusMinutes: Math.round(totalSeconds / 60)
    };
  }, [selectedDayEntries, selectedDayKey, locale]);

  const selectedDayNarrative = useMemo(() => {
    if (!selectedDaySummary || !selectedDayDetail?.totalSeconds) {
      return t("summarySentenceIdle");
    }
    return interpolate(t("summarySentenceActive"), {
      duration: formatDuration(selectedDayDetail.totalSeconds),
      project: selectedDaySummary.top_project || t("unknown"),
      app: selectedDaySummary.top_app || t("unknown")
    });
  }, [selectedDaySummary, selectedDayDetail, locale]);

  const trendByGroup = useMemo(() => {
    const now = new Date(statistics.asOf * 1000);
    const dayCount = 7;
    const dayKeys: TrendDay[] = [];
    const dayMap = new Map<string, Map<string, number>>();
    const totalsByGroup = new Map<string, number>();
    const firstDay = new Date(startOfLocalDay(now));
    firstDay.setDate(firstDay.getDate() - (dayCount - 1));
    const firstDaySec = toEpochSecond(firstDay);

    for (let i = 0; i < dayCount; i += 1) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      const key = localDayKey(d);
      dayKeys.push({ key, label: key.slice(5), totalSec: 0, segments: [] });
      dayMap.set(key, new Map());
    }

    for (const row of statisticsEntries) {
      const groupName =
        chartGroup === "project"
          ? row.project || row.app_name || t("unknown")
          : row.app_name || t("unknown");

      allocateEntryToBuckets(row, firstDaySec, 24 * 3600, dayCount, (index, sec) => {
        const dayKey = dayKeys[index]?.key;
        if (!dayKey) return;
        const bucket = dayMap.get(dayKey);
        if (!bucket) return;
        bucket.set(groupName, (bucket.get(groupName) ?? 0) + sec);
        totalsByGroup.set(groupName, (totalsByGroup.get(groupName) ?? 0) + sec);
      });
    }

    const topGroups = Array.from(totalsByGroup.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const colorMap = new Map<string, string>();
    topGroups.forEach((name, index) => {
      colorMap.set(name, CHART_COLORS[index % CHART_COLORS.length]);
    });
    colorMap.set(t("otherGroup"), CHART_COLORS[topGroups.length % CHART_COLORS.length]);

    return dayKeys.map((day) => {
      const bucket = dayMap.get(day.key) ?? new Map();
      const totalSec = Array.from(bucket.values()).reduce((sum, sec) => sum + sec, 0);

      const primary = topGroups
        .map((name) => ({ name, sec: bucket.get(name) ?? 0 }))
        .filter((item) => item.sec > 0);
      const otherSec = Array.from(bucket.entries())
        .filter(([name]) => !topGroups.includes(name))
        .reduce((sum, [, sec]) => sum + sec, 0);

      const combined = otherSec > 0 ? [...primary, { name: t("otherGroup"), sec: otherSec }] : primary;

      return {
        key: day.key,
        label: day.label,
        totalSec,
        segments: combined.map((item) => ({
          ...item,
          ratio: totalSec ? item.sec / totalSec : 0,
          color: colorMap.get(item.name) ?? CHART_COLORS[0]
        }))
      };
    });
  }, [statistics, chartGroup, locale]);

  const timelineRows = useMemo(() => {
    const q = timelineQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((row) => {
      const hay = [
        row.app_name,
        row.activity_type || "",
        row.entity_name || "",
        row.detail || "",
        row.workspace || "",
        row.file_name || "",
        row.domain || "",
        row.window_title,
        row.project || "",
        row.tag || "",
        row.source || ""
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, timelineQuery]);

  const totalPages = Math.max(1, Math.ceil(timelineRows.length / pageSize));

  const visibleDashboardBuckets = useMemo(() => {
    if (!hideEmptyBuckets) return dashboard.buckets;
    const filtered = dashboard.buckets.filter((bucket) => bucket.sec > 0);
    return filtered;
  }, [dashboard.buckets, hideEmptyBuckets]);

  const filteredAppSuggestions = useMemo(() => {
    const query = ruleForm.app_pattern.trim().toLowerCase();
    const appNames = ruleSuggestions.app_names;
    const matches = query
      ? appNames.filter((name) => name.toLowerCase().includes(query))
      : appNames;
    return matches.slice(0, 8);
  }, [ruleForm.app_pattern, ruleSuggestions.app_names]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return timelineRows.slice(start, start + pageSize);
  }, [timelineRows, page, pageSize]);

  const active = status?.last_active ?? null;

  function showHoverTip(event: ReactMouseEvent<Element>, text: string) {
    setHoverTip({
      text,
      x: Math.max(8, Math.min(event.clientX + 14, window.innerWidth - 294)),
      y: Math.max(8, Math.min(event.clientY + 14, window.innerHeight - 90))
    });
  }

  function hideHoverTip() {
    setHoverTip(null);
  }

  async function changeTracking(enabled: boolean) {
    try {
      const next = await invoke<RuntimeStatus>("set_tracking_enabled", { enabled });
      setStatus(next);
      await refreshActivityData();
    } catch (err) {
      setWarning(String(err));
    }
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="clock" /></div>
          <div><strong>Timing Lite<span className="brand-period">.</span></strong><small>ACTIVITY TRACKER</small></div>
        </div>
        <div className="nav-label">{t("navigation")}</div>
        <nav className="view-tabs" aria-label={t("view")}>
          {NAVIGATION.map((item) => (
            <button key={item.view} className={`view-tab ${viewMode === item.view ? "active" : ""}`}
              aria-current={viewMode === item.view ? "page" : undefined}
              onClick={() => { setViewMode(item.view); hideHoverTip(); }}>
              <Icon name={item.icon} /><span>{t(item.label)}</span>
              {viewMode === item.view ? <Icon name="chevron" className="nav-chevron" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`tracking-card ${status?.tracking_enabled ? "is-recording" : "is-paused"}`}>
            <div className="tracking-card-top">
              <span className="tracking-status"><i className="status-dot" />{t(status?.tracking_enabled ? "recording" : "paused")}</span>
              <label className="switch-label">
                <span className="sr-only">{t("tracking")}</span>
                <input className="switch" type="checkbox" checked={status?.tracking_enabled ?? false}
                  disabled={!status} onChange={(event) => { void changeTracking(event.target.checked); }} />
              </label>
            </div>
            <p>{t("backgroundHint")}</p>
          </div>
          <div className="local-note" title={t("storagePolicy")}>
            <Icon name="shield" /><div><span>{t("localOnly")}</span><small>{t("storageSummary")}</small></div>
          </div>
          <div className="sidebar-preferences">
            <label><span className="sr-only">{t("language")}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="zh">简体中文</option><option value="en">English</option>
              </select>
            </label>
            <button className="theme-toggle" aria-label={t(theme === "light" ? "darkTheme" : "lightTheme")}
              title={t(theme === "light" ? "darkTheme" : "lightTheme")}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              <Icon name={theme === "light" ? "moon" : "sun"} />
            </button>
          </div>
        </div>
      </aside>
      <main className={`app app--${viewMode}`} aria-busy={loading}>
        <header className="workspace-header">
          <div className="breadcrumb"><span>{t("workspace")}</span><Icon name="chevron" /><b>{t(NAVIGATION.find((item) => item.view === viewMode)!.label)}</b></div>
          <time dateTime={localDayKey(new Date())}><Icon name="calendar" />{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</time>
        </header>
        <div className="page-heading">
          <div><h1>{t(`${viewMode}Heading`)}</h1><p>{t(`${viewMode}Description`)}</p></div>
          <details className="settings-popover" ref={settingsRef}>
            <summary><Icon name="settings" />{t("preferences")}</summary>
            <div className="settings-content">
              <label className="settings-row"><span>{t("detailMode")}</span><input className="switch" type="checkbox" checked={detailMode} onChange={(event) => setDetailMode(event.target.checked)} /></label>
              <label className="settings-row"><span>{t("interval")}</span>
                <select value={status?.interval_ms ?? 5000} onChange={async (event) => {
                  try {
                    setStatus(await invoke<RuntimeStatus>("set_capture_interval", { intervalMs: Number(event.target.value) }));
                  } catch (err) { setWarning(String(err)); }
                }}>
                  <option value={3000}>3s</option><option value={5000}>5s</option><option value={10000}>10s</option><option value={15000}>15s</option>
                </select>
              </label>
              <button className="btn capture-button" disabled={!status?.tracking_enabled} onClick={async () => {
                try {
                  await invoke("capture_active_window");
                  await Promise.all([refreshStatus(), refreshActivityData()]);
                } catch (err) { setWarning(String(err)); }
              }}><Icon name="refresh" />{t("captureNow")}</button>
            </div>
          </details>
        </div>
        {warning ? <p className="warn" role="alert">{warning}</p> : null}
        {loading ? <p className="loading-notice" role="status">{t("loadingActivity")}</p> : null}
        {viewMode === "dashboard" && active ? (
          <div className="live-strip">
            <span className="active-app-mark">{active.app_name.slice(0, 1).toUpperCase()}</span>
            <div><small>{t("current")}</small><strong>{active.app_name}</strong></div>
            <span className="live-context" title={buildContextPrimary(active)}>{buildContextPrimary(active) || active.window_title}</span>
            <span className="live-label"><i className="status-dot" />{t("recording")}</span>
          </div>
        ) : null}

      {viewMode === "overview" ? (
      <>
      <section className="panel">
        <div className="panel-head">
          <h2>{t("dayOverview")}</h2>
          <span className="muted">{t("allInOneScreen")}</span>
        </div>
        <div className="overview-grid">
          <div className="overview-block">
            <h3>{t("current")}</h3>
            {active ? (
              <div className="current">
                <strong>{active.app_name}</strong>
                <span>{buildContextPrimary(active) || active.window_title || "(No title)"}</span>
                {detailMode ? (
                  <small>
                    {[
                      localizedActivityType(active.activity_type, t),
                      active.workspace,
                      active.domain
                    ]
                      .filter((item) => item && item !== "-")
                      .join(" · ")}
                  </small>
                ) : null}
                <small>{asDateText(active.captured_at)}</small>
              </div>
            ) : (
              <p className="muted">{t("noActive")}</p>
            )}
          </div>

          <div className="overview-block">
            <h3>{t("metrics")}</h3>
            <div className="kpi-grid compact">
              <div className="kpi-card">
                <span>{t("todayTotal")}</span>
                <strong>{formatDuration(dayOverview.totalSeconds)}</strong>
              </div>
              <div className="kpi-card">
                <span>{t("focusMinutes")}</span>
                <strong>{dayOverview.focusMinutes}</strong>
              </div>
              <div className="kpi-card">
                <span>{t("ruleCoverage")}</span>
                <strong>{dayOverview.coverage}%</strong>
              </div>
              <div className="kpi-card">
                <span>{t("runningSegments")}</span>
                <strong>{formatDuration(dayOverview.runningSeconds)}</strong>
              </div>
            </div>
          </div>

          <div className="overview-block">
            <h3>{t("hourDistribution")}</h3>
            <div className="hour-bars">
              {dayOverview.hourBuckets.map((item) => (
                <div className="hour-col" key={item.hour}>
                  <div className="hour-track">
                    <div
                      className="hour-fill"
                      style={{
                        height: `${Math.round((item.sec / dayOverview.maxBucket) * 100)}%`
                      }}
                    />
                  </div>
                  <span>{String(item.hour).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overview-block">
            <h3>{t("topProjects")}</h3>
            {dayOverview.topProjects.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dayOverview.topProjects.length ? <p className="muted">{t("noProjectData")}</p> : null}
          </div>

          <div className="overview-block">
            <h3>{t("topTags")}</h3>
            {dayOverview.topTags.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dayOverview.topTags.length ? <p className="muted">{t("noTagData")}</p> : null}
          </div>

          <div className="overview-block">
            <h3>{t("topApps")}</h3>
            {dayOverview.topApps.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dayOverview.topApps.length ? <p className="muted">{t("noAppData")}</p> : null}
          </div>
        </div>
      </section>
      </>
      ) : null}

      {viewMode === "dashboard" ? (
      <section className="panel">
        <div className="panel-head">
          <h2>{t("statsDashboard")}</h2>
          <div className="controls">
            <label>
              <span>{t("hideEmptyBuckets")}</span>
              <input
                type="checkbox"
                checked={hideEmptyBuckets}
                onChange={(e) => setHideEmptyBuckets(e.target.checked)}
              />
            </label>
            <label>
              <span>{t("range")}</span>
              <select
                value={rangeHours}
                onChange={(e) => setRangeHours(Number(e.target.value))}
              >
                <option value={6}>{t("recent6h")}</option>
                <option value={24}>{t("recent24h")}</option>
                <option value={168}>{t("recent7d")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <span>{t("rangeTotal")}</span>
            <strong>{formatDuration(dashboard.totalSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("runningSegments")}</span>
            <strong>{formatDuration(dashboard.runningSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("uncategorized")}</span>
            <strong>{formatDuration(dashboard.uncategorizedSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("ruleCoverage")}</span>
            <strong>
              {dashboard.totalSeconds
                ? `${Math.max(
                    0,
                    Math.round(
                      ((dashboard.totalSeconds - dashboard.uncategorizedSeconds) /
                        Math.max(1, dashboard.totalSeconds)) *
                        100
                    )
                  )}%`
                : "0%"}
            </strong>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="mini-panel">
            <h3>{t("trend")}</h3>
            <div className="bars">
              {visibleDashboardBuckets.map((d) => (
                <div className="bar-row" key={d.startSec}>
                  <span>{d.label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.round((d.sec / dashboard.maxBucketSec) * 100)}%`
                      }}
                    />
                  </div>
                  <b>{formatDuration(d.sec)}</b>
                </div>
              ))}
            </div>
            {!visibleDashboardBuckets.length ? <div className="empty-state"><Icon name="clock" /><strong>{t("noData")}</strong><p>{t("emptyHint")}</p></div> : null}
          </div>

          <div className="mini-panel">
            <h3>{t("topProjects")}</h3>
            {dashboard.topProjects.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dashboard.topProjects.length ? (
              <p className="muted">{t("noProjectData")}</p>
            ) : null}
          </div>

          <div className="mini-panel">
            <h3>{t("topTags")}</h3>
            {dashboard.topTags.map((item) => (
              <div className="mini-row" key={item.name}>
                <span>{item.name}</span>
                <b>{formatDuration(item.sec)}</b>
              </div>
            ))}
            {!dashboard.topTags.length ? <p className="muted">{t("noTagData")}</p> : null}
          </div>
        </div>
      </section>
      ) : null}

      {viewMode === "daily" ? (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{t("dailyBoard")}</h2>
            <p className="muted">{t("dailyBoardHint")}</p>
          </div>
          <div className="controls">
            <label>
              <span>{t("range")}</span>
              <select
                value={dailyWindowDays}
                onChange={(e) => setDailyWindowDays(Number(e.target.value))}
              >
                <option value={7}>{t("recent7d")}</option>
                <option value={14}>{t("recent14d")}</option>
                <option value={30}>{t("recent30d")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="daily-layout">
          <div className="daily-calendar-panel">
            <div className="daily-calendar-head">
              <strong>{describeDayWindow(dailyWindowDays, t)}</strong>
              <span className="muted">{t("selectDayHint")}</span>
            </div>
            {dailySummaries.some((item) => item.total_seconds > 0) ? (
              <div className="daily-calendar-grid" ref={calendarRef}>
                {dailySummaries.map((item) => {
                  const isActive = item.day_key === selectedDayKey;
                  const intensity = Math.min(1, item.total_seconds / Math.max(1, 8 * 3600));
                  return (
                    <button
                      type="button"
                      key={item.day_key}
                      className={`day-card ${isActive ? "active" : ""}`}
                      onClick={() => { setSelectedDayKey(item.day_key); hideHoverTip(); }}
                      aria-pressed={isActive}
                    >
                      <div className="day-card-top">
                        <span>{formatDayLabel(item.day_key, locale)}</span>
                        <small>{formatWeekdayLabel(item.day_key, locale)}</small>
                      </div>
                      <strong>{formatDuration(item.total_seconds)}</strong>
                      <small>{item.top_project || item.top_app || t("unknown")}</small>
                      <div className="day-card-meta">
                        <span>{item.coverage}%</span>
                        <span>{item.entry_count} {t("records")}</span>
                      </div>
                      <div className="day-meter" aria-hidden="true"><span style={{ width: `${intensity * 100}%` }} /></div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="muted">{t("calendarEmpty")}</p>
            )}
          </div>

          <div className="daily-detail-panel">
            <div className="panel-head">
              <div>
                <h3>{selectedDayKey ? formatDayLabel(selectedDayKey, locale) : t("dailySummary")}</h3>
                <p className="muted">{selectedDayNarrative}</p>
              </div>
            </div>

            {selectedDaySummary && selectedDayDetail ? (
              <>
                <div className="kpi-grid compact daily-kpis">
                  <div className="kpi-card">
                    <span>{t("dayTotal")}</span>
                    <strong>{formatDuration(selectedDayDetail.totalSeconds)}</strong>
                  </div>
                  <div className="kpi-card">
                    <span>{t("dayFocusMinutes")}</span>
                    <strong>{selectedDayDetail.focusMinutes}</strong>
                  </div>
                  <div className="kpi-card">
                    <span>{t("ruleCoverage")}</span>
                    <strong>{selectedDaySummary.coverage}%</strong>
                  </div>
                  <div className="kpi-card">
                    <span>{t("entriesCaptured")}</span>
                    <strong>{selectedDaySummary.entry_count}</strong>
                  </div>
                </div>

                <div className="daily-summary-grid">
                  <div className="mini-panel">
                    <h3>{t("selectedDayUsage")}</h3>
                    <div className="mini-row">
                      <span>{t("topProjectLabel")}</span>
                      <b>{selectedDaySummary.top_project || "-"}</b>
                    </div>
                    <div className="mini-row">
                      <span>{t("topAppLabel")}</span>
                      <b>{selectedDaySummary.top_app || "-"}</b>
                    </div>
                    <div className="mini-row">
                      <span>{t("topTagLabel")}</span>
                      <b>
                        {selectedDaySummary.total_seconds
                          ? selectedDaySummary.top_tag || t("uncategorizedTag")
                          : "-"}
                      </b>
                    </div>
                  </div>

                  <div className="mini-panel">
                    <h3>{t("hourDistribution")}</h3>
                    <div className="hour-bars hour-bars--compact">
                      {selectedDayDetail.hourBuckets.map((item) => (
                        <div className="hour-col" key={item.hour}>
                          <div className="hour-track">
                            <div
                              className="hour-fill"
                              style={{
                                height: `${Math.round((item.sec / selectedDayDetail.maxBucket) * 100)}%`
                              }}
                            />
                          </div>
                          <span>{String(item.hour).padStart(2, "0")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="daily-summary-grid">
                  <div className="mini-panel">
                    <h3>{t("topProjects")}</h3>
                    {selectedDayDetail.topProjects.map((item) => (
                      <div className="mini-row" key={item.name}>
                        <span>{item.name}</span>
                        <b>{formatDuration(item.sec)}</b>
                      </div>
                    ))}
                    {!selectedDayDetail.topProjects.length ? (
                      <p className="muted">{t("noProjectData")}</p>
                    ) : null}
                  </div>

                  <div className="mini-panel">
                    <h3>{t("topApps")}</h3>
                    {selectedDayDetail.topApps.map((item) => (
                      <div className="mini-row" key={item.name}>
                        <span>{item.name}</span>
                        <b>{formatDuration(item.sec)}</b>
                      </div>
                    ))}
                    {!selectedDayDetail.topApps.length ? <p className="muted">{t("noAppData")}</p> : null}
                  </div>
                </div>

                <div className="mini-panel">
                  <h3>{t("dailyHighlights")}</h3>
                  {selectedDayDetail.topContexts.map((item) => (
                    <div className="mini-row" key={item.id}>
                      <span>{item.appName} · {item.contextPrimary}</span>
                      <b>{formatDuration(item.sec)}</b>
                    </div>
                  ))}
                  {!selectedDayDetail.topContexts.length ? <p className="muted">{t("noData")}</p> : null}
                </div>
              </>
            ) : (
              <p className="muted">{t("selectDayHint")}</p>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {viewMode === "charts" ? (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{t("charts")}</h2>
            <p className="muted">{t("chartsRangeHint")}</p>
          </div>
          <label>
            <span>{t("range")}</span>
            <select
              value={rangeHours}
              onChange={(e) => setRangeHours(Number(e.target.value))}
            >
              <option value={6}>{t("recent6h")}</option>
              <option value={24}>{t("recent24h")}</option>
              <option value={168}>{t("recent7d")}</option>
            </select>
          </label>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <span>{t("range")}</span>
            <strong>{describeRange(rangeHours, t)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("rangeTotal")}</span>
            <strong>{formatDuration(dashboard.totalSeconds)}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("topProjects")}</span>
            <strong>{dashboard.topProjects[0]?.name ?? "-"}</strong>
          </div>
          <div className="kpi-card">
            <span>{t("topApps")}</span>
            <strong>{dashboard.topApps[0]?.name ?? "-"}</strong>
          </div>
        </div>

        <div className="charts-grid">
          <div className="mini-panel">
            <h3>{t("topProjects")}</h3>
            <PieChart
              slices={dashboard.projectSlices}
              totalLabel={t("total")}
              emptyText={t("noProjectData")}
              onShowTip={showHoverTip}
              onHideTip={hideHoverTip}
            />
          </div>
          <div className="mini-panel">
            <h3>{t("topTags")}</h3>
            <PieChart
              slices={dashboard.tagSlices}
              totalLabel={t("total")}
              emptyText={t("noTagData")}
              onShowTip={showHoverTip}
              onHideTip={hideHoverTip}
            />
          </div>
          <div className="mini-panel">
            <h3>{t("topApps")}</h3>
            <PieChart
              slices={dashboard.appSlices}
              totalLabel={t("total")}
              emptyText={t("noAppData")}
              onShowTip={showHoverTip}
              onHideTip={hideHoverTip}
            />
          </div>
        </div>

        <div className="mini-panel trend-panel">
          <div className="panel-head">
            <div>
              <h3>{t("dailyTrend")}</h3>
              <p className="muted">{t("trendHint")}</p>
            </div>
            <label>
              <span>{t("groupBy")}</span>
              <select
                value={chartGroup}
                onChange={(e) => setChartGroup(e.target.value as ChartGroup)}
              >
                <option value="project">{t("groupByProject")}</option>
                <option value="app">{t("groupByApp")}</option>
              </select>
            </label>
          </div>
          <StackedTrendChart
            days={trendByGroup}
            emptyText={t("noData")}
            onShowTip={showHoverTip}
            onHideTip={hideHoverTip}
          />
        </div>
      </section>
      ) : null}

      {viewMode === "rules" ? (
      <section className="panel">
        <div className="panel-head">
          <h2>{t("rules")}</h2>
          <button
            className="btn"
            onClick={() => {
              refreshRules().catch((err) => setWarning(String(err)));
            }}
          >
            {t("refreshRules")}
          </button>
        </div>

        <div className="rule-editor">
        <div className="rule-editor-heading"><Icon name="rules" /><div><h3>{t("addRule")}</h3><p className="muted">{t("ruleHint")}</p></div></div>
        <div className="rule-form-grid">
          <label><span>{t("ruleName")}</span><input placeholder={locale === "zh" ? "例如：设计工作" : "e.g. Design work"} value={ruleForm.name} onChange={(e) => setRuleForm((s) => ({ ...s, name: e.target.value }))} /></label>
          <label><span>{t("appContains")}</span><input list="rule-app-suggestions" placeholder="Figma, Chrome…" value={ruleForm.app_pattern} onChange={(e) => setRuleForm((s) => ({ ...s, app_pattern: e.target.value }))} /></label>
          <label><span>{t("titleContains")}</span><input placeholder={locale === "zh" ? "例如：项目名称" : "e.g. Project name"} value={ruleForm.title_pattern} onChange={(e) => setRuleForm((s) => ({ ...s, title_pattern: e.target.value }))} /></label>
          <label><span>{t("project")}</span><input placeholder={t("project")} value={ruleForm.project} onChange={(e) => setRuleForm((s) => ({ ...s, project: e.target.value }))} /></label>
          <label><span>{t("tag")}</span><input placeholder={t("tag")} value={ruleForm.tag} onChange={(e) => setRuleForm((s) => ({ ...s, tag: e.target.value }))} /></label>
          <label><span>{t("priority")}</span><input type="number" value={ruleForm.priority} onChange={(e) => setRuleForm((s) => ({ ...s, priority: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 100 }))} /></label>
        </div>

        <datalist id="rule-app-suggestions">
          {ruleSuggestions.app_names.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {filteredAppSuggestions.length ? (
          <div className="rule-suggestion-wrap">
            <span className="muted">{t("appSuggestHint")}</span>
            <div className="rule-suggestion-row">
              {filteredAppSuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="suggest-chip"
                  onClick={() => setRuleForm((s) => ({ ...s, app_pattern: name }))}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rule-actions">
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!ruleForm.app_pattern.trim() && !ruleForm.title_pattern.trim()) {
                setWarning(t("rulePatternRequired"));
                return;
              }
              try {
                const next = await invoke<RuleRow[]>("add_rule", {
                  input: {
                    name: ruleForm.name,
                    app_pattern: ruleForm.app_pattern,
                    title_pattern: ruleForm.title_pattern,
                    project: ruleForm.project || null,
                    tag: ruleForm.tag || null,
                    priority: ruleForm.priority
                  }
                });
                setRules(next);
                setRuleForm(DEFAULT_RULE_FORM);
                setWarning(null);
                await refreshActivityData();
              } catch (err) {
                setWarning(String(err));
              }
            }}
          >
            {t("addRule")}
          </button>
        </div>

        </div>
        <div className="table-scroll rules-table"><table>
          <thead>
            <tr>
              <th>{t("ruleName")}</th>
              <th>{t("pattern")}</th>
              <th>{t("projectTag")}</th>
              <th>{t("priority")}</th>
              <th>{t("status")}</th>
              <th>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>
                  {t("app")}: {rule.app_pattern || "*"}
                  <br />
                  {t("window")}: {rule.title_pattern || "*"}
                </td>
                <td>
                  {(rule.project || "-") + " / " + (rule.tag || "-")}
                </td>
                <td>{rule.priority}</td>
                <td><span className={`rule-status ${rule.enabled ? "enabled" : "disabled"}`}>{rule.enabled ? t("enabled") : t("disabled")}</span></td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          const next = await invoke<RuleRow[]>("set_rule_enabled", {
                            ruleId: rule.id,
                            enabled: !rule.enabled
                          });
                          setRules(next);
                          setWarning(null);
                          await refreshActivityData();
                        } catch (err) {
                          setWarning(String(err));
                        }
                      }}
                    >
                      {rule.enabled ? t("disable") : t("enable")}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={async () => {
                        try {
                          const next = await invoke<RuleRow[]>("delete_rule", {
                            ruleId: rule.id
                          });
                          setRules(next);
                          setWarning(null);
                          await refreshActivityData();
                        } catch (err) {
                          setWarning(String(err));
                        }
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rules.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state"><Icon name="rules" /><strong>{t("noRules")}</strong><p>{t("rulesEmptyHint")}</p></div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table></div>
      </section>
      ) : null}

      {viewMode === "timeline" ? (
      <section className="panel">
        <div className="panel-head">
          <h2>{t("timeline")}</h2>
          <div className="search-field"><Icon name="search" /><input
            aria-label={t("listSearch")}
            className="search-input"
            value={timelineQuery}
            onChange={(e) => {
              setTimelineQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("listSearch")}
          /></div>
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            <div className="table-scroll timeline-table"><table>
              <thead>
                <tr>
                  <th>{t("activityType")}</th>
                  <th>{t("context")}</th>
                  <th>{t("app")}</th>
                  <th>{t("project")}</th>
                  {detailMode ? <th>{t("tag")}</th> : null}
                  {detailMode ? <th>{t("source")}</th> : null}
                  <th>{t("start")}</th>
                  {detailMode ? <th>{t("end")}</th> : null}
                  <th>{t("duration")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const contextPrimary = buildContextPrimary(row);
                  const contextMeta = buildContextMeta(row, t);
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="activity-pill">
                          {localizedActivityType(row.activity_type, t)}
                        </span>
                      </td>
                      <td className="context-cell">
                        <div className="context-primary">
                          {contextPrimary || t("noContext")}
                        </div>
                        {detailMode && contextMeta.length ? (
                          <div className="context-meta">
                            {contextMeta.map((item) => (
                              <span key={item}>{item}</span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="app-meta">
                          <strong>{row.app_name}</strong>
                          {detailMode && row.bundle_id ? <small>{row.bundle_id}</small> : null}
                        </div>
                      </td>
                      <td>{row.project || "-"}</td>
                      {detailMode ? <td>{row.tag || "-"}</td> : null}
                      {detailMode ? <td>{row.source || t("defaultSource")}</td> : null}
                      <td className="time-cell">{asDateText(row.started_at)}</td>
                      {detailMode ? <td className="time-cell">{row.ended_at ? asDateText(row.ended_at) : t("running")}</td> : null}
                      <td>{formatDuration(row.duration_seconds)}</td>
                    </tr>
                  );
                })}
                {!pageRows.length ? (
                  <tr>
                    <td colSpan={detailMode ? 9 : 6}>
                      <div className="empty-state"><Icon name="list" /><strong>{t(timelineQuery ? "noSearchResults" : "noData")}</strong><p>{t(timelineQuery ? "searchEmptyHint" : "emptyHint")}</p></div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table></div>

            <div className="pagination">
              <div className="page-meta">
                <span>{t("total")} {timelineRows.length} {t("records")}</span><small>{t("timelineHint")}</small>
              </div>
              <div className="page-controls">
                <label>
                  <span>{t("pageSize")}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t("prev")}
                </button>
                <span>{t("page")} {page} / {totalPages}</span>
                <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      ) : null}

      {hoverTip ? (
        <div className="hover-tip" style={{ left: hoverTip.x, top: hoverTip.y }}>
          {hoverTip.text}
        </div>
      ) : null}
      </main>
    </div>
  );
}
