export const WORKSPACES = Object.freeze([
  {
    id: "today",
    label: "今日",
    sections: [
      { id: "marketOverview", label: "市场概览" },
      { id: "actionQueue", label: "待处理事项" },
      { id: "marketEvents", label: "动态与新闻" },
      { id: "upcomingEarnings", label: "官方财报" }
    ]
  },
  {
    id: "calendar",
    label: "日历",
    sections: [
      { id: "marketCalendar", label: "市场日历" },
      { id: "marketHistory", label: "日度脉络" }
    ]
  },
  {
    id: "portfolio",
    label: "我的",
    sections: [
      { id: "cloudPanel", label: "云同步" },
      { id: "watchlistControls", label: "自选设置" },
      { id: "personalStats", label: "个人概览" },
      { id: "decisionWorkspace", label: "决策工作区" },
      { id: "personalObservations", label: "观察记录" },
      { id: "decisionLog", label: "决策日志" },
      { id: "toolsPanel", label: "个人规则" },
      { id: "watchlist", label: "持仓与自选" }
    ]
  },
  {
    id: "research",
    label: "研究",
    sections: [
      { id: "researchQuality", label: "研究覆盖" },
      { id: "researchHealth", label: "运行健康" },
      { id: "dailyResearchReports", label: "每日研究" },
      { id: "weeklyResearchReports", label: "每周汇总" },
      { id: "researchReplay", label: "研究回放" },
      { id: "researchTaskBoard", label: "任务看板" },
      { id: "eventReviewQueue", label: "归因审核" },
      { id: "modelReview", label: "模型复核" }
    ]
  }
]);

export const WORKSPACE_IDS = Object.freeze(WORKSPACES.map(function (workspace) {
  return workspace.id;
}));

// These anchors point to nested content rather than top-level workspace sections.
// Keep old shared links working while the layout is organized into workspaces.
const LEGACY_SECTION_WORKSPACES = Object.freeze({
  beginnerReadingHome: "today"
});

export function normalizeWorkspace(value, fallback = "today") {
  const id = String(value || "").trim().toLowerCase();
  return WORKSPACE_IDS.includes(id) ? id : fallback;
}

export function getWorkspace(value) {
  const id = normalizeWorkspace(value);
  return WORKSPACES.find(function (workspace) { return workspace.id === id; }) || WORKSPACES[0];
}

export function resolveWorkspaceHash(hash) {
  const value = String(hash || "").replace(/^#/, "").trim();
  const workspaceId = normalizeWorkspace(value, "");
  if (workspaceId) return { workspaceId: workspaceId, sectionId: "" };

  if (LEGACY_SECTION_WORKSPACES[value]) {
    return { workspaceId: LEGACY_SECTION_WORKSPACES[value], sectionId: value };
  }

  for (const workspace of WORKSPACES) {
    const section = workspace.sections.find(function (item) { return item.id === value; });
    if (section) return { workspaceId: workspace.id, sectionId: section.id };
  }
  return { workspaceId: "today", sectionId: "" };
}
