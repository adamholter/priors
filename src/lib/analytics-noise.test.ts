import { describe, expect, it } from "vitest";
import { isNoiseException } from "./analytics";
import { DOM_GUARD_SCRIPT } from "./dom-guard";

describe("error tracking noise", () => {
  it("drops browser and extension noise, keeps real errors", () => {
    expect(isNoiseException({ $exception_values: ["Script error."] })).toBe(true);
    expect(isNoiseException({ $exception_values: ["AbortError: Transition was skipped. New ViewTransition started"] })).toBe(true);
    expect(isNoiseException({ $exception_values: ["ResizeObserver loop completed with undelivered notifications."] })).toBe(true);
    expect(isNoiseException({ $exception_values: ["NotFoundError: Failed to execute 'removeChild' on 'Node'"] })).toBe(false);
    expect(isNoiseException({ $exception_values: ["TypeError: x is undefined"] })).toBe(false);
    expect(isNoiseException(undefined)).toBe(false);
  });
});

describe("page-translation guard", () => {
  it("skips removing a node that is no longer a child instead of throwing", () => {
    const P = { removeChild(c: { parentNode: unknown }) { if (c.parentNode !== this) throw new Error("NotFoundError"); return c; }, insertBefore(n: unknown) { return n; } };
    const g = globalThis as unknown as { Node: unknown; window: unknown };
    const saved = { Node: g.Node, window: g.window };
    function Node() { /* stand-in */ }
    Node.prototype = P;
    g.Node = Node; g.window = { dispatchEvent: () => true };
    try {
      new Function(DOM_GUARD_SCRIPT)();
      const parent = Object.create(P), stray = { parentNode: {} };
      expect(() => parent.removeChild(stray)).not.toThrow();
      expect(parent.removeChild({ parentNode: parent })).toBeTruthy();
    } finally { g.Node = saved.Node; g.window = saved.window; }
  });
});
