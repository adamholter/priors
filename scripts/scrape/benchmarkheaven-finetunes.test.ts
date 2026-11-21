import { describe, expect, it } from "vitest";
import { communityFinetune } from "./sources/benchmarkheaven";

describe("Benchmark Heaven community fine-tunes", () => {
  it("leaves out fine-tunes under community accounts, which matched their base model and replaced its score", () => {
    for (const n of ["Disya/Mistral-Chimera-Pro-24B", "SentientAGI/Dobby-Mini-Unhinged-Llama-3.1-8B", "ArliAI/Qwen3-30B-A3B-ArliAI-RpR-v4-Fast", "DavidAU/gemma-3-12b-it-vl-Polaris"]) expect(communityFinetune(n), n).toBe(true);
  });
  it("keeps labs' own accounts and plain names", () => {
    for (const n of ["mistralai/Mistral-Nemo-Instruct-2407", "meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen3-30B-A3B", "google/gemma-3-12b-it", "x-ai/grok-4.20-beta", "z-ai/glm-5", "Grok 4.20 Beta 1", "GPT-4 (0314)"]) expect(communityFinetune(n), n).toBe(false);
  });
});
