import { describe, expect, it } from "vitest";
import { findAAIdentityCollisions, resolveAAIdentity, type AAModelRecord } from "./aa-identity";

const aa = (overrides: Partial<AAModelRecord> = {}): AAModelRecord => ({
  id: "2f339a97-9a0d-499a-9cb5-e0db665bfa25",
  slug: "gpt-6-astra",
  name: "GPT-6 Astra (max)",
  effort: { slug: "max" },
  isReasoning: true,
  creator: { slug: "openai", name: "OpenAI" },
  ...overrides,
});

describe("resolveAAIdentity", () => {
  it("keeps Grok releases separate while recognizing equivalent spellings and efforts", () => {
    const identity = (name: string, slug: string, release: string) => resolveAAIdentity(aa({ name, slug, effort: { slug: "high" }, release: { name: release } }));
    expect(identity("Grok 4.5 (High)", "grok-4-5", "Grok 4.5").modelId).toBe("grok-4.5");
    expect(identity("x-ai/grok-4-6-high", "grok-4-6", "Grok 4.6").modelId).toBe("grok-4.6");
  });

  it("rejects a UUID join with conflicting release identities instead of grouping them", () => {
    expect(() => resolveAAIdentity(aa({ name: "Grok 4.5 (High)", slug: "grok-4-6", release: { name: "Grok 4.6" } }))).toThrow(/identity conflict/);
    expect(() => resolveAAIdentity(aa({ name: "Grok 4.5 (High)" }), aa({ name: "Grok 4.6 (High)" }))).toThrow(/identity conflict/);
  });
  it.each([
    ["gpt-6-astra-non-reasoning", "GPT-6 Astra (Non-reasoning)", undefined, false, "none"],
    ["gpt-6-astra-low", "GPT-6 Astra (low)", "low", true, "low"],
    ["gpt-6-astra-medium", "GPT-6 Astra (medium)", "medium", true, "medium"],
    ["gpt-6-astra-xhigh", "GPT-6 Astra (xhigh)", "xhigh", true, "xhigh"],
    ["gpt-6-astra", "GPT-6 Astra (max)", "max", true, "max"],
  ])("keeps Astra modes under one known model: %s", (slug, name, effort, isReasoning, expected) => {
    const identity = resolveAAIdentity(aa({ id: `${slug}-uuid`, slug, name, effort: effort ? { slug: effort } : undefined, isReasoning }));
    expect(identity.modelId).toBe("gpt-6-astra");
    expect(identity.effort).toBe(expected);
  });

  it("uses table effort while retaining the evaluation UUID and slug", () => {
    const identity = resolveAAIdentity(
      aa({ id: "evaluation-uuid", slug: "gpt-6-astra-low", effort: undefined }),
      aa({ id: "evaluation-uuid", slug: "gpt-6-astra-low", effort: { slug: "low" } }),
    );
    expect(identity).toMatchObject({ sourceModelId: "evaluation-uuid", sourceSlug: "gpt-6-astra-low", effort: "low" });
  });

  it("preserves fallback configurations that share a model and effort", () => {
    const withFallback = resolveAAIdentity(aa({ id: "aaaaaaaa-1111", slug: "claude-fable-5-1", name: "Claude Fable 5.1 (Adaptive Reasoning, Max Effort, Default Fallback)", creator: { slug: "anthropic" } }));
    const withoutFallback = resolveAAIdentity(aa({ id: "bbbbbbbb-2222", slug: "claude-fable-5-1-no-fallback", name: "Claude Fable 5.1 (Adaptive Reasoning, Max Effort, No Fallback)", creator: { slug: "anthropic" } }));
    expect(withFallback.modelId).toBe("claude-fable-5.1");
    expect(withFallback.configuration).toContain("aaaaaaaa");
    expect(withoutFallback.configuration).toContain("bbbbbbbb");
    expect(withFallback.variantId).not.toBe(withoutFallback.variantId);
  });

  it("keeps unknown AA records representable and source scoped", () => {
    const identity = resolveAAIdentity(aa({ id: "12345678-aaaa", slug: "future-model-v9-special", name: "Future Model V9 Special", effort: undefined, isReasoning: false, creator: { slug: "future-lab" } }));
    expect(identity).toMatchObject({ modelId: "aa-future-model-v9-special", labId: "other", effort: "none", sourceModelId: "12345678-aaaa" });
    expect(identity.variantId).toContain("~aa-future-model-v9-special-12345678");
  });

  it("reports true source-record collisions", () => {
    const first = resolveAAIdentity(aa({ id: "same-source", slug: "gpt-6-astra" }));
    expect(findAAIdentityCollisions([first, { ...first, sourceModelId: "other-source" }])).toEqual([{
      variantId: "gpt-6-astra@max",
      sourceModelIds: ["same-source", "other-source"],
      sourceSlugs: ["gpt-6-astra"],
    }]);
  });

  it("rejects records without AA's authoritative UUID", () => {
    expect(() => resolveAAIdentity({ slug: "model-without-id", name: "Model Without ID" })).toThrow(/authoritative id/);
  });
});
