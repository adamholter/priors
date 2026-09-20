/// <reference lib="webworker" />
import type { Snapshot } from "../data/types";
import { fitPriors, type FitPriorities } from "./optimizer";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<{ snapshot: Snapshot; target: string[]; quality?: Record<string, number>; priorities?: FitPriorities; reducedMotion?: boolean }>) => {
  try {
    await fitPriors(event.data.snapshot, event.data.target, (update) => self.postMessage(update), event.data.quality, event.data.reducedMotion ? 0 : 240, event.data.priorities);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
