import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { SOLIDWORKS_BENCH_ID, parseSolidWorksBench } from "./sources/solidworks-bench";

const row = (name: string, cost: string, reward: string) => `<tr><th><span class="ml" style="--c:#000"><i class="sw"></i>${name}</span></th><td>${cost}</td><td>$1</td><td>363</td><td>3.6 h</td><td>2</td><td>${reward}</td></tr>`;
const point = (full: string, short: string) => `<g><circle cx="1" cy="2" r="7"><title>${full}</title></circle><text class="lbl" x="3" y="4" text-anchor="start">${short}</text></g>`;
const page = (rows: string, points: string, effort = "reasoning effort high for every model") => `<time datetime="2026-11-17">17 Nov</time><span class="ch-sub">73 machines · PNG drawings · one attempt</span><p>${effort}.</p>
<table class="tbl"><tr><th>Per machine</th></tr></table>
<h3>Where the reward comes from</h3><div class="ch-bd groups"><div><span class="ml"><i class="sw"></i>GLM 5.3</span><div class="mini"><span class="k">Geometry 45%</span><div class="track sm"><b style="width:8.25%;opacity:1"></b></div></div><div class="mini"><span class="k">Assembly 30%</span><div class="track sm"><b style="width:27%"></b></div></div></div></div></figure>
<table class="tbl cost"><thead><tr><th>Model</th><th>$ / machine</th><th>$ all 73</th><th>Median turns</th><th>Median time</th><th>Time limit hit</th><th>Reward</th></tr></thead><tbody>${rows}</tbody></table><svg>${points}</svg>`;

describe("SolidWorks-Bench", () => {
  it("reads reward, cost and time, under the exact model name the cost chart gives", () => {
    const { rows, machines, updated } = parseSolidWorksBench(page(row("Fable 5.2", "$1,069.10", "0.573") + row("GLM 5.3", "$3.04", "0.064"), point("Claude Fable 5.2", "Fable 5.2") + point("GLM 5.3 Flash", "GLM 5.3")));
    expect([machines, updated]).toEqual([73, "2026-11-17"]);
    expect(rows.map((r) => [r.benchmarkId, r.modelLabel, r.effort, r.value, r.costUsd, r.durationSec])).toEqual([[SOLIDWORKS_BENCH_ID, "Claude Fable 5.2", "high", 57.3, 1069.1, 12960], [SOLIDWORKS_BENCH_ID, "GLM 5.3 Flash", "high", 6.4, 3.04, 12960]]);
    expect(rows[1].details).toMatchObject({ reward: 0.064, medianTurns: 363, timeLimitHits: 2, geometry: 8.25, assembly: 27 });
    expect(normalizeLabel(rows[1].modelLabel)).toMatchObject({ modelId: "glm-5.3-flash" });
  });
  it("fails rather than guess a model or an effort", () => {
    expect(() => parseSolidWorksBench(page(row("GLM 5.3", "$3", "0.064"), ""))).toThrow(/exact model name/);
    expect(() => parseSolidWorksBench(page(row("GLM 5.3", "$3", "0.064"), point("GLM 5.3 Flash", "GLM 5.3"), "several efforts"))).toThrow(/reasoning effort/);
    expect(() => parseSolidWorksBench("<table></table>")).toThrow(/cost table/);
  });
  it("matches every model the report names", () => {
    for (const [label, id] of [["GPT-6 Astra", "gpt-6-astra"], ["Kimi K3.1 Pro", "kimi-k3.1"], ["DeepSeek V4.1 Flash", "deepseek-v4.1-flash"], ["Muse Spark Open", "aa-muse-spark-open"], ["MiniMax M3.1 Flash", "minimax-m3.1"]]) expect(normalizeLabel(label), label).toMatchObject({ modelId: id });
  });
});
