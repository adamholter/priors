import { describe, expect, it } from "vitest";
import { parseRobotics } from "./sources/aa-robotics";

// Shape of the October 14 2026 article bundle, trimmed to two models and two tasks.
const bundle = `let a=[{id:"gpt-6-astra",name:"GPT-6 Astra",creatorName:"OpenAI",creatorColor:"#1f1f1f",harness:"Codex"},{id:"claude-opus-5-5",name:"Claude Opus 5.5",creatorName:"Anthropic",harness:"Claude Code"}],o=[{id:"press-red-button",name:"Press the red button",shortName:"Press Button",instruction:"Press the button.",success:"It flashes."},{id:"pour-drink-into-cup",name:"Pour the drink into the cup",shortName:"Pour Drink",instruction:"Pour.",success:"Drink in cup."}];let x={"a":{"b":1}};let s={"gpt-6-astra":{"press-red-button":100,"pour-drink-into-cup":40},"claude-opus-5-5":{"press-red-button":100}};`;

describe("AA-Robotics", () => {
  it("averages every task per model, keeps the harness and effort, and skips models missing a task", () => {
    const r = parseRobotics(bundle, "GPT models run in Codex, all at the high effort setting.");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ modelLabel: "GPT-6 Astra", value: 70, effort: "high", harness: "Codex", labHint: "OpenAI" });
  });
  it("fails loudly when the bundle no longer carries a score map", () => {
    expect(() => parseRobotics(bundle.replace(/let s=.*$/, ""), "")).toThrow(/score map/);
  });
});
