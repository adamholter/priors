import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { FRONTIERML_SYNSCI_ID, parseFrontierML } from "./sources/frontierml-synsci";

const row = (name: string, exact: number, shown: string, partial = "") => `<div class="bd-row bd-r"><div class="bd-who"><b>${name}</b></div><div class="bd-track"><a class="bd-dot" href="/runs/x"></a><span class="bd-tick" style="left:calc(5px + ${exact} * (100% - 10px));background:#777"></span></div><span class="bd-mean">${shown}${partial}</span></div>`;
const page = (rows: string) => `<p class="sec-lede">Each model’s mean normalized score over the 25 graded tasks of 25.</p><figure><div class="bd-row bd-head"></div>${rows}</figure>`;
const html = page(row("Claude Fable 5.2", 0.5227599999999999, "0.523") + row("Gemini 4 Carbon", 0.35344, "0.353") + row("Grok 4.7", 0.11513, "0.115", `<i aria-label="over 15 of the 25 tasks">*</i>`));

describe("FrontierML (Synthetic Sciences)", () => {
  const { rows, tasks, partial } = parseFrontierML(html);
  it("reads the exact mean over every graded task, with no stated effort", () => {
    expect(tasks).toBe(25);
    expect(rows.map((r) => [r.benchmarkId, r.modelLabel, r.value, r.effortUnstated])).toEqual([[FRONTIERML_SYNSCI_ID, "Claude Fable 5.2", 52.28, true], [FRONTIERML_SYNSCI_ID, "Gemini 4 Carbon", 35.34, true]]);
  });
  it("leaves out a model scored on only some of the tasks", () => {
    expect(partial).toEqual(["Grok 4.7 (15 of 25 tasks)"]);
  });
  it("refuses a mean marker that does not match the shown mean", () => {
    expect(() => parseFrontierML(page(row("Claude Fable 5.2", 0.6, "0.523")))).toThrow(/row changed/);
  });
  it("resolves the site's names", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
});
