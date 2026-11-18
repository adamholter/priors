import { describe, expect, it } from "vitest";
import { aaProviderRows, mergeProviders, openRouterOffers, providerKey } from "./providers";

describe("provider data", () => {
  it("keeps one OpenRouter row per provider: the cheapest regular endpoint, in dollars per 1M", () => {
    const rows = openRouterOffers([
      { provider_name: "Fireworks", tag: "fireworks/spot", pricing: { prompt: "0.0000001", completion: "0.0000002" } },
      { provider_name: "Fireworks", tag: "fireworks", pricing: { prompt: "0.0000014", completion: "0.0000044" }, context_length: 1000, uptime_last_1d: 99.5 },
      { provider_name: "Fireworks", tag: "fireworks/fast", pricing: { prompt: "0.0000021", completion: "0.0000066" } },
      { provider_name: "Router", pricing: { prompt: "-1", completion: "-1" } },
      { provider_name: "Wafer", tag: "wafer/us", pricing: { prompt: "0.00000007", completion: "0.0000014" } },
    ]);
    expect(rows).toEqual([{ provider: "Wafer", input: 0.07, output: 1.4 }, { provider: "Fireworks", input: 1.4, output: 4.4, context: 1000, uptime: 99.5 }]);
  });

  it("reads Artificial Analysis' standard tier and takes medians across efforts", () => {
    const row = (label: string, speed: number) => ({ label, host: { name: "Supernova" }, model: { release: { slug: "glm-5-3" } }, pricing: { price1mInputTokens: 0.63, price1mOutputTokens: 1.98 }, performance: { outputSpeed: speed, timeToFirstToken: 1.5, endpointErrorRate: 0 } });
    expect(aaProviderRows([row("GLM (low)", 100), row("GLM (max)", 200), row("GLM (low) (FAST)", 900)]).get("glm-5-3")).toEqual([{ provider: "Supernova", input: 0.63, output: 1.98, speed: 150, ttft: 1.5, errorRate: 0 }]);
  });

  it("joins the two sources under one name and keeps providers only one of them lists", () => {
    expect(providerKey("Together AI")).toBe(providerKey("Together"));
    const rows = mergeProviders([{ provider: "Together", input: 1, output: 2 }, { provider: "Wafer", input: 3, output: 4 }], [{ provider: "Together AI", input: 9, output: 9, speed: 100, ttft: 1 }, { provider: "Scaleway", input: 5, output: 6, speed: 50 }]);
    expect(rows.map((r) => [r.provider, r.input, r.speed])).toEqual([["Together", 1, 100], ["Wafer", 3, undefined], ["Scaleway", 5, 50]]);
  });
});
