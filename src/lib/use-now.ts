"use client";
import { useSyncExternalStore } from "react";
import { MIN } from "./freshness";

// One interval for every reader, running only while something is mounted.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  timer ??= setInterval(() => listeners.forEach((f) => f()), 30_000);
  return () => { listeners.delete(onChange); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
}

/** The time to the minute, so a relative label re-renders once a minute and not on every tick. 0 on the server and while hydrating (no mismatch): show nothing until it is not 0. */
export const useNow = () => useSyncExternalStore(subscribe, () => Math.floor(Date.now() / MIN) * MIN, () => 0);
