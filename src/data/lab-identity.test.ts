import { describe, expect, it } from "vitest";
import { aaCreatorLab, withLabIdentity } from "./lab-identity";
import { labLogo } from "./lab-logos";
import { LABS } from "./normalize";
import type { Snapshot } from "./types";

const aaSource = (creator?: string, url = "https://artificialanalysis.ai/models/x") => ({ id: "x", slug: "x", name: "X", url, metadata: creator ? { creator: { slug: creator } } : {} });
const snap = (models: { id: string; labId: string }[], creators: Record<string, string | undefined>, labs = LABS.filter((l) => ["openai", "other"].includes(l.id)), url?: string) => ({
  labs, models: models.map((m) => ({ ...m, name: m.id, kind: "llm", reasoning: true, aliases: [] })),
  variants: models.map((m) => ({ id: `${m.id}@max`, modelId: m.id, effort: "max", sourceModel: aaSource(creators[m.id], url) })),
}) as unknown as Snapshot;

describe("aaCreatorLab", () => {
  it("reads an Artificial Analysis creator slug as the lab it names, in any of its spellings", () => {
    for (const [slug, lab] of [["ibm", "ibm"], ["liquidai", "liquid-ai"], ["ai21-labs", "ai21"], ["lg", "lg-ai-research"], ["kwaikat", "kuaishou"], ["multiversecomputing", "multiverse-computing"], ["trillionlabs", "trillion-labs"], ["reka-ai", "reka"], ["swiss-ai-initiative", "swiss-ai"], ["tii-uae", "tii"], ["sk-telecom", "sk-telecom"], ["kimi", "moonshot"], ["inclusionai", "ant-group"], ["longcat", "meituan"], ["ai9star", "ai9stars"], ["deepcogito", "deep-cogito"]] as const)
      expect(aaCreatorLab(slug), slug).toBe(lab);
  });
  it("credits Nova to Amazon and Phi to Microsoft, not to the platforms AA files them under", () => {
    expect(aaCreatorLab("aws")).toBe("amazon");
    expect(aaCreatorLab("azure")).toBe("microsoft");
  });
  it("never makes a provider, a plan seller or an unknown creator a model's lab", () => {
    for (const slug of ["groq", "together-ai", "openrouter", "factory", "other", "", undefined, 3, "a-lab-nobody-listed"]) expect(aaCreatorLab(slug), String(slug)).toBeUndefined();
  });
  it("only names labs that have a logo entry and a chart color", () => {
    for (const slug of ["ibm", "aws", "azure", "nex", "stepfun", "perplexity", "arcee", "upstage"]) {
      const id = aaCreatorLab(slug)!;
      expect(labLogo(id), id).toBeTruthy();
      expect(LABS.some((l) => l.id === id), `${id} needs a chart color in LABS`).toBe(true);
    }
  });
});

describe("withLabIdentity", () => {
  const models = [{ id: "aa-granite-4", labId: "other" }, { id: "aa-nova-lite", labId: "other" }, { id: "gpt-6", labId: "openai" }, { id: "aa-mystery", labId: "other" }];
  const creators = { "aa-granite-4": "ibm", "aa-nova-lite": "aws", "gpt-6": "openai", "aa-mystery": "somebody-unlisted" };
  it("moves a model AA credits to a listed lab out of other, and adds that lab with its name and color", () => {
    const s = withLabIdentity(snap(models, creators));
    expect(Object.fromEntries(s.models.map((m) => [m.id, m.labId]))).toEqual({ "aa-granite-4": "ibm", "aa-nova-lite": "amazon", "gpt-6": "openai", "aa-mystery": "other" });
    expect(s.labs.find((l) => l.id === "ibm")).toMatchObject({ name: "IBM", color: LABS.find((l) => l.id === "ibm")!.color });
    expect(s.labs.find((l) => l.id === "amazon")?.name).toBe("Amazon");
    expect(s.labs.some((l) => l.id === "other")).toBe(true);
  });
  it("leaves a model a family pattern placed alone, even when AA names another creator", () => {
    const s = withLabIdentity(snap([{ id: "llama-3.1-70b", labId: "meta" }], { "llama-3.1-70b": "nous-research" }));
    expect(s.models[0].labId).toBe("meta");
  });
  it("trusts only Artificial Analysis for who made a model", () => {
    const s = withLabIdentity(snap([{ id: "m", labId: "other" }], { m: "ibm" }, undefined, "https://example.com/models/m"));
    expect(s.models[0].labId).toBe("other");
  });
  it("is a no-op, same object, once nothing sits in other", () => {
    const clean = snap([{ id: "gpt-6", labId: "openai" }], {});
    expect(withLabIdentity(clean).models).toBe(clean.models);
  });
});
