import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchPlanResets, GEMINI_RESETS, parseClaudeResets, parseCodexResets } from "./plan-resets";
import { planResetBoosts } from "../../src/data/plan-resets";
import type { ScrapeContext, Snapshot } from "../../src/data/types";

const fixture = (f: string) => readFileSync(path.join(__dirname, "fixtures", f), "utf8");

describe("plan reset sources", () => {
  it("reads every Codex reset with its time and type", () => {
    const events = parseCodexResets(fixture("opentherank-codex-reset.html"));
    expect(events).toHaveLength(69);
    expect(events.filter((e) => e.kind === "banked")).toHaveLength(8);
    expect(events.filter((e) => e.kind === "reset")).toHaveLength(59);
    expect(events.filter((e) => e.kind === "both")).toHaveLength(2);
    expect(events[0]).toMatchObject({ at: "2025-09-17T04:02:52.000Z", kind: "reset" });
    expect(events.at(-1)?.at).toBe("2026-10-28T06:29:38.078Z");
    expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort());
  });

  it("reads Claude's resets and leaves out policy changes", () => {
    const events = parseClaudeResets(JSON.parse(fixture("claude-resets.json")));
    expect(events).toHaveLength(14);
    expect(events.filter((e) => e.kind === "banked")).toHaveLength(1);
    expect(events.some((e) => /affected/i.test(e.scope ?? ""))).toBe(true);
  });

  it("marks Claude's Fable 5.2 grant as a Fable-only refill, and a full banked reset as a full one", () => {
    const file = { providers: { claude: { events: [
      ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-0${i + 1}-01T00:00:00Z`, kind: "reset", scope: "all" })),
      { date: "2026-11-09T19:21:45Z", kind: "reset", resetType: "banked", scope: "paid plans", note: "Eligible paid accounts get a Fable 5.2 reset grant: Max/Ultra ... receive 1-3 by paid tenure. Each restores only Fable usage on the weekly meter; other weekly usage stays spent." },
      { date: "2026-11-10T21:59:58Z", kind: "reset", resetType: "banked", scope: "Pro, Max, Ultra + Team", note: "One free full reset for all Pro, Max, Ultra and Team users, across all models and limits, including Fable resets that did little." },
    ] } } };
    const events = parseClaudeResets(file);
    expect(events.slice(-2).map((e) => [e.kind, e.refills])).toEqual([["banked", "fable"], ["banked", undefined]]);
  });

  it("keeps Antigravity's Thanksgiving Gemini reset (one reset, though two posts announced it)", () => {
    expect(GEMINI_RESETS).toEqual([{ at: "2026-11-26T07:17:00.000Z", kind: "reset", scope: "all", url: "https://x.com/_mohansolo/status/2125851902009311306" }]);
    const boost = planResetBoosts({ date: "2026-11-27", generatedAt: "2026-11-27T12:00:00Z", planResets: [{ labId: "google", plan: "Google AI (Antigravity)", source: "x", url: "x", events: GEMINI_RESETS }] } as unknown as Snapshot).get("google")!;
    expect(boost).toMatchObject({ resets: 1, banked: 0, clock: "rolling", weeks: 0.5 });
    expect(boost.boost).toBeCloseTo(1 + 0.5 / (30 / 7), 9);
  });
  it("refuses a page or file that no longer has the data, instead of reading it as 'no resets'", () => {
    expect(() => parseCodexResets("<html>new design</html>")).toThrow(/page changed/);
    expect(() => parseClaudeResets({ providers: {} })).toThrow(/unexpected/);
    expect(() => parseClaudeResets({ providers: { claude: { events: [] } } })).toThrow(/file changed/);
  });

  it("keeps the labs that worked and names the one that failed", async () => {
    const ctx = { now: "", log: () => {}, fetchText: async (url: string) => { if (url.includes("claude")) throw new Error("down"); return fixture("opentherank-codex-reset.html"); } } as unknown as ScrapeContext;
    const r = await fetchPlanResets(ctx);
    expect(r.resets.map((x) => x.labId)).toEqual(["google", "openai"]); // Google's list is kept in the code, so it never fails.
    expect(r.failed).toEqual(["anthropic"]);
    await expect(fetchPlanResets({ ...ctx, fetchText: async () => { throw new Error("down"); } } as unknown as ScrapeContext)).rejects.toThrow(/no reset history/);
  });
});
