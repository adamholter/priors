"use client";
import { useCallback, useEffect, useState } from "react";
import { readCoreSnapshot } from "@/data/packed-snapshot";
import type { Snapshot } from "@/data/types";

/**
 * The calculation dataset (`/api/snapshot?view=core`), loaded once per tab and shared: the builder, model,
 * compare and 3D pages reuse one parsed copy as a visitor moves between them, instead of each downloading and
 * holding its own. Refreshed after a few minutes so a long session still picks up new data on its next page.
 */
const FRESH_MS = 5 * 60_000;
let cached: { at: number; promise: Promise<Snapshot> } | null = null;

export function loadCoreSnapshot(): Promise<Snapshot> {
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.promise;
  const promise = fetch("/api/snapshot?view=core&packed=1").then((r) => {
    if (!r.ok) throw new Error("Could not load benchmark data.");
    return readCoreSnapshot(r);
  });
  const entry = { at: Date.now(), promise };
  cached = entry;
  // A failed load is not kept: the next page or Retry asks again.
  promise.catch(() => { if (cached === entry) cached = null; });
  return promise;
}

export function useCoreSnapshot(): { snapshot: Snapshot | null; error: string; retry: () => void } {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setError(""); setAttempt((n) => n + 1); }, []);
  useEffect(() => {
    let live = true;
    loadCoreSnapshot().then((s) => { if (live) setSnapshot(s); }, (e) => { if (live) setError(e instanceof Error ? e.message : "Could not load benchmark data."); });
    return () => { live = false; };
  }, [attempt]);
  return { snapshot, error, retry };
}
