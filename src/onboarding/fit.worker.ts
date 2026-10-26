/// <reference lib="webworker" />
import type { Snapshot } from "../data/types";
import { fitPriors, type FitPriorities } from "./optimizer";
import type { FocusId } from "./focus";
import type { MixLibrary } from "./library";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<{ snapshot: Snapshot; target: string[]; quality?: Record<string, number>; priorities?: FitPriorities; reducedMotion?: boolean; focus?: FocusId; library?: MixLibrary }>) => {
  try {
    await fitPriors(event.data.snapshot, event.data.target, (update) => self.postMessage(update), event.data.quality, event.data.reducedMotion ? 0 : 70, event.data.priorities, { focus: event.data.focus, library: event.data.library });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
