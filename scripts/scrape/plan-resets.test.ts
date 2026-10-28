import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchPlanResets, parseClaudeResets, parseCodexResets } from "./plan-resets";
import type { ScrapeContext } from "../../src/data/types";

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

  it("refuses a page or file that no longer has the data, instead of reading it as 'no resets'", () => {
    expect(() => parseCodexResets("<html>new design</html>")).toThrow(/page changed/);
    expect(() => parseClaudeResets({ providers: {} })).toThrow(/unexpected/);
    expect(() => parseClaudeResets({ providers: { claude: { events: [] } } })).toThrow(/file changed/);
  });

  it("keeps the labs that worked and names the one that failed", async () => {
    const ctx = { now: "", log: () => {}, fetchText: async (url: string) => { if (url.includes("claude")) throw new Error("down"); return fixture("opentherank-codex-reset.html"); } } as unknown as ScrapeContext;
    const r = await fetchPlanResets(ctx);
    expect(r.resets.map((x) => x.labId)).toEqual(["openai"]);
    expect(r.failed).toEqual(["anthropic"]);
    await expect(fetchPlanResets({ ...ctx, fetchText: async () => { throw new Error("down"); } } as unknown as ScrapeContext)).rejects.toThrow(/no reset history/);
  });
});
