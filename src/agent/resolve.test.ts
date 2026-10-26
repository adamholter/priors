import { describe, expect, it } from "vitest";
import { resolveModel } from "./resolve";
import type { Snapshot } from "../data/types";

const names = ["MiMo V2", "MiMo V2 Flash", "MiMo V2.5", "MiMo V2.6 Flash", "MiMo V2.6 Pro", "Opus 5", "Opus 5.5", "GPT-6 Astra", "GPT-6.1 Sol", "Gemini 4", "Kimi K3"];
const snapshot = { models: names.map((n) => ({ id: n.toLowerCase().replace(/[^a-z0-9.]+/g, "-"), name: n, kind: "llm", aliases: [] })) } as unknown as Snapshot;
const id = (name: string) => resolveModel(snapshot, name);

describe("resolving model names", () => {
  it("takes exact and partial names", () => {
    expect(id("opus 5.5")).toBe("opus-5.5");
    expect(id("GPT 6 Astra")).toBe("gpt-6-astra");
  });
  it("repairs a dictated name that is a few characters off", () => {
    expect(id("MiMo V6 v 2.6 Flash")).toBe("mimo-v2.6-flash");
    expect(id("Mimo v 2.6 flash")).toBe("mimo-v2.6-flash");
  });
  it("never guesses a different version or an unknown family", () => {
    expect(id("Opus 6")).toBeNull();
    expect(id("GPT 7 Astra")).toBeNull();
    expect(id("Llama 5")).toBeNull();
    expect(id("MiMo V9 Flash")).toBeNull();
  });
});
