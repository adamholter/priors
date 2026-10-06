#!/usr/bin/env node
/**
 * Creates (or recreates) the "Priors" PostHog dashboard via the API.
 * Keys come from the macOS keychain: posthog-personal-api-key (personal, dashboard/insight write).
 * Usage: node scripts/posthog-dashboard.mjs <project_id> [host]
 */
import { execFileSync } from "node:child_process";

const [projectId, host = "https://us.posthog.com"] = process.argv.slice(2);
if (!projectId) { console.error("usage: node scripts/posthog-dashboard.mjs <project_id> [host]"); process.exit(1); }
const key = execFileSync("security", ["find-generic-password", "-s", "posthog-personal-api-key", "-w"]).toString().trim();
const api = async (path, body, method = "POST") => {
  const res = await fetch(`${host}/api/projects/${projectId}${path}`, { method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

const NAME = "Priors";
const days = { date_from: "-30d" };
const ev = (event, extra = {}) => ({ kind: "EventsNode", event, name: event, ...extra });
const trends = (series, opts = {}) => ({ kind: "InsightVizNode", source: { kind: "TrendsQuery", series, interval: "day", dateRange: days, ...opts } });
const path = (p) => ({ properties: [{ key: "$pathname", value: p, operator: p.includes("*") ? "regex" : "exact", type: "event" }] });

const INSIGHTS = [
  { name: "Unique visitors per day", description: "Daily active users (anonymous included).", query: trends([ev("$pageview", { math: "dau", custom_name: "Visitors" })]) },
  { name: "Weekly active users", query: trends([ev("$pageview", { math: "weekly_active", custom_name: "WAU" })], { interval: "week", dateRange: { date_from: "-90d" } }) },
  { name: "Share funnel (30d)", description: "Visit → finished ranking → opened share card → shared / published.",
    query: { kind: "InsightVizNode", source: { kind: "FunnelsQuery", series: [ev("$pageview", { custom_name: "Visited" }), ev("onboarding_completed", { custom_name: "Finished ranking" }), ev("share_card_opened", { custom_name: "Opened share card" }), ev("share_card_shared", { custom_name: "Shared to X" })], dateRange: days, funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: "day" } } } },
  { name: "Publish funnel (30d)", query: { kind: "InsightVizNode", source: { kind: "FunnelsQuery", series: [ev("onboarding_completed", { custom_name: "Finished ranking" }), ev("$pageview", { custom_name: "Opened builder", ...path("/builder") }), ev("profile_claimed", { custom_name: "Claimed page" })], dateRange: days, funnelsFilter: { funnelWindowInterval: 7, funnelWindowIntervalUnit: "day" } } } },
  { name: "Key actions per day", query: trends([ev("onboarding_completed"), ev("share_card_opened"), ev("share_card_shared"), ev("chart_exported"), ev("profile_claimed"), ev("assistant_asked")]) },
  { name: "Top pages", query: trends([ev("$pageview", { math: "dau" })], { breakdownFilter: { breakdown: "$pathname", breakdown_type: "event", breakdown_limit: 15 }, trendsFilter: { display: "ActionsBarValue" } }) },
  { name: "Where visitors come from", query: trends([ev("$pageview", { math: "dau" })], { breakdownFilter: { breakdown: "$referring_domain", breakdown_type: "event", breakdown_limit: 15 }, trendsFilter: { display: "ActionsBarValue" } }) },
  { name: "Countries", query: trends([ev("$pageview", { math: "dau" })], { breakdownFilter: { breakdown: "$geoip_country_name", breakdown_type: "event", breakdown_limit: 15 }, trendsFilter: { display: "ActionsBarValue" } }) },
  { name: "Exports by chart and format", query: trends([ev("chart_exported")], { breakdownFilter: { breakdowns: [{ property: "chart", type: "event" }, { property: "format", type: "event" }] }, trendsFilter: { display: "ActionsBarValue" } }) },
  { name: "Returning visitors (weekly retention)", query: { kind: "InsightVizNode", source: { kind: "RetentionQuery", retentionFilter: { targetEntity: { id: "$pageview", type: "events" }, returningEntity: { id: "$pageview", type: "events" }, period: "Week", totalIntervals: 8, retentionType: "retention_first_time" }, dateRange: { date_from: "-56d" } } } },
];

const existing = await api("/dashboards/?limit=200", undefined, "GET");
for (const d of existing.results.filter((d) => d.name === NAME && !d.deleted)) await api(`/dashboards/${d.id}/`, { deleted: true }, "PATCH");
const dash = await api("/dashboards/", { name: NAME, description: "Priors usage: visitors, ranking, sharing and publishing. Created by scripts/posthog-dashboard.mjs.", pinned: true });
for (const i of INSIGHTS) {
  const made = await api("/insights/", { ...i, dashboards: [dash.id], saved: true });
  console.log(`+ ${made.name}`);
}
console.log(`${host}/project/${projectId}/dashboard/${dash.id}`);
