import { describe, expect, it } from "vitest";
import { buildBoggs } from "./boggs";
import { FRONTIER_CS_ID, parseFrontierCs } from "./frontiercs";

const MODELS = [["opus", "Claude Opus 5.5", "Claude Code", "Anthropic"], ["sonnet55", "Claude Sonnet 5.5", "Claude Code", "Anthropic"], ["inkling", "Inkling 2 Small", "Pi", "Thinking Machines"],
  ["minimax", "MiniMax-M3.1-Flash", "Claude Code", "MiniMax"], ["step", "Step 5 Preview", "Step Code", "StepFun"], ["new", "Unscored Model", "X", "Lab"]];
const JS = `function f(){}const a=1,MODELS=[${MODELS.map(([id, name, h, lab]) => `{id:"${id}",name:"${name}",short:"${name}",h:"${h}",lab:"${lab}"}`).join(",")}],UPDATED="November 6, 2026",`
  + `PASS={opus:[58.3,28,48],sonnet55:[50,24,48],inkling:[8.3,4,48],minimax:[8.3,4,48],step:[10.4,5,48]},ECI={opus:[51.3,42.7,60.7,48]};`;

describe("FrontierCS 2", () => {
  it("reads every scored model from the publisher's data file, with harness and FCI", () => {
    const { rows, updated } = parseFrontierCs(JS);
    expect(updated).toBe("2026-11-06");
    expect(rows.map((r) => [r.modelLabel, r.value, r.harness])).toEqual([
      ["Claude Opus 5.5", 58.3, "Claude Code"], ["Claude Sonnet 5.5", 50, "Claude Code"], ["Inkling 2 Small", 8.3, "Pi"], ["MiniMax-M3.1-Flash", 8.3, "Claude Code"], ["Step 5 Preview", 10.4, "Step Code"],
    ]);
    expect(rows[0]).toMatchObject({ benchmarkId: FRONTIER_CS_ID, details: { passed: 28, tasks: 48, fci: 51.3, fciInterval: [42.7, 60.7] } });
    expect(rows[1].details).toEqual({ passed: 24, tasks: 48 });
  });
  it("fails loudly when the data file changes shape", () => {
    expect(() => parseFrontierCs("const PASS={};")).toThrow(/schema changed/);
    expect(() => parseFrontierCs(JS.replace("58.3,28", "158.3,28"))).toThrow(/out of range/);
  });
  it("keeps the old id and drops the dashboard's second-hand copy", () => {
    expect(FRONTIER_CS_ID).toBe("bg-frontier-cs-2");
    const data = buildBoggs({ benchmarks: [{ id: "frontier-cs-2", name: "FrontierCS 2" }], results: Array.from({ length: 6 }, (_, i) => ({ benchmark_id: "frontier-cs-2", model: `model-${i}`, raw_score: 20 })) });
    expect(data.rows).toEqual([]);
  });
});
