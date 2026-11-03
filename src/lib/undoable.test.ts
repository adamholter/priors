import { describe, expect, it } from "vitest";
import { applyEdit, QUIET_MS, startUndoable, undoEdit } from "./undoable";

describe("undoable", () => {
  it("steps back through separate edits", () => {
    let s = startUndoable("a");
    s = applyEdit(s, "b", 10_000);
    s = applyEdit(s, "c", 20_000);
    expect(s.present).toBe("c");
    s = undoEdit(s);
    expect(s.present).toBe("b");
    s = undoEdit(s);
    expect(s.present).toBe("a");
    expect(undoEdit(s)).toBe(s);
  });

  it("treats a run of quick edits as one step", () => {
    let s = startUndoable(0);
    for (let i = 1; i <= 5; i++) s = applyEdit(s, i, 10_000 + i * (QUIET_MS - 100));
    expect(s.past).toEqual([0]);
    expect(undoEdit(s).present).toBe(0);
  });

  it("starts a new step right after an undo", () => {
    let s = startUndoable("a");
    s = applyEdit(s, "b", 10_000);
    s = undoEdit(s);
    s = applyEdit(s, "c", 10_001);
    expect(s.past).toEqual(["a"]);
  });

  it("ignores a change that changes nothing", () => {
    const s = startUndoable("a");
    expect(applyEdit(s, "a", 10_000)).toBe(s);
  });

  it("keeps a bounded history", () => {
    let s = startUndoable(0);
    for (let i = 1; i <= 100; i++) s = applyEdit(s, i, i * 10_000);
    expect(s.past.length).toBe(30);
  });
});
