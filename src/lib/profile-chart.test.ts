import { describe, expect, it } from "vitest";
import { resolveProfileChart } from "./profile-chart";
import { decodeIndex } from "./url";

const a = decodeIndex("My priors|swe:50", "i0")!, b = decodeIndex("WebDev Index|arena:60", "i1")!;

describe("profile chart links", () => {
  it("finds the cost chart a page shows without having saved it", () => {
    expect(resolveProfileChart({ indices: [a, b], sections: [] }, "webdev-index-vs-cost-per-task")).toBe("cost");
    expect(resolveProfileChart({ indices: [a, b], sections: undefined }, "my-priors-vs-cost-per-task")).toBe("cost");
    expect(resolveProfileChart({ indices: [a, b], sections: [] }, "webdev-index")).toBe("rankings");
  });
  it("also finds it under the subscription title the page uses when the index prices by subscription", () => {
    expect(resolveProfileChart({ indices: [a, b], sections: [] }, "webdev-index-vs-subscription-cost-per-task")).toBe("cost");
    expect(resolveProfileChart({ indices: [a], sections: undefined }, "my-priors-vs-subscription-cost-per-task")).toBe("cost");
  });
  it("keeps canonical ids, and passes through anchors it does not know", () => {
    expect(resolveProfileChart({ indices: [a], sections: [] }, "time-per-task")).toBe("time-per-task");
    expect(resolveProfileChart({ indices: [a], sections: [] }, "nothing-here")).toBe("nothing-here");
    expect(resolveProfileChart({ indices: [a], sections: [] }, null)).toBeUndefined();
  });
  it("follows a saved custom title and ignores a hidden section", () => {
    const sections = [{ id: "p", kind: "pareto" as const, indexId: "i1", title: "Cost curve" }, { id: "r", kind: "rankings" as const, hidden: true }];
    expect(resolveProfileChart({ indices: [a, b], sections }, "cost-curve")).toBe("cost");
  });
});
