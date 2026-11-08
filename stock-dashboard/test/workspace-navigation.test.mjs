import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACE_IDS, getWorkspace, normalizeWorkspace, resolveWorkspaceHash } from "../lib/workspace-navigation.mjs";

test("workspace navigation keeps the four deliberate work areas", function () {
  assert.deepEqual(WORKSPACE_IDS, ["today", "calendar", "portfolio", "research"]);
  assert.equal(getWorkspace("research").label, "研究");
  assert.equal(getWorkspace("unknown").id, "today");
});

test("workspace normalization accepts only known workspace ids", function () {
  assert.equal(normalizeWorkspace("CALENDAR"), "calendar");
  assert.equal(normalizeWorkspace("unknown"), "today");
  assert.equal(normalizeWorkspace("unknown", "portfolio"), "portfolio");
});

test("legacy section hashes open the matching workspace without losing the target", function () {
  assert.deepEqual(resolveWorkspaceHash("#beginnerReadingHome"), { workspaceId: "today", sectionId: "beginnerReadingHome" });
  assert.deepEqual(resolveWorkspaceHash("#marketCalendar"), { workspaceId: "calendar", sectionId: "marketCalendar" });
  assert.deepEqual(resolveWorkspaceHash("#decisionLog"), { workspaceId: "portfolio", sectionId: "decisionLog" });
  assert.deepEqual(resolveWorkspaceHash("#research"), { workspaceId: "research", sectionId: "" });
  assert.deepEqual(resolveWorkspaceHash("#not-real"), { workspaceId: "today", sectionId: "" });
});
