import { describe, expect, it } from "vitest";
import { createChartUndo, isChartUndoKey } from "./chart-undo";

describe("chart undo", () => {
  it("reverses removals across charts in the order the user made them", () => {
    const undo = createChartUndo(), bars = {}, scatter = {}, restored: string[] = [];
    undo.record(bars, () => restored.push("bars effort"));
    undo.record(scatter, () => restored.push("scatter model"));
    undo.record(bars, () => restored.push("bars model"));
    expect(undo.undo()).toBe(true);
    expect(undo.undo()).toBe(true);
    expect(undo.undo()).toBe(true);
    expect(undo.undo()).toBe(false);
    expect(restored).toEqual(["bars model", "scatter model", "bars effort"]);
  });
  it("lets a chart's Undo button reverse its own action without consuming another chart's action", () => {
    const undo = createChartUndo(), bars = {}, scatter = {}, restored: string[] = [];
    undo.record(bars, () => restored.push("bars"));
    undo.record(scatter, () => restored.push("scatter"));
    expect(undo.undo(bars)).toBe(true);
    expect(undo.undo(bars)).toBe(false);
    expect(undo.undo()).toBe(true);
    expect(restored).toEqual(["bars", "scatter"]);
  });
  it("forgets unmounted charts while preserving the remaining chart history", () => {
    const undo = createChartUndo(), gone = {}, remaining = {}, restored: string[] = [];
    undo.record(remaining, () => restored.push("remaining"));
    undo.record(gone, () => restored.push("gone"));
    undo.forget(gone);
    expect(undo.undo()).toBe(true);
    expect(undo.undo()).toBe(false);
    expect(restored).toEqual(["remaining"]);
  });
  it("accepts both undo shortcuts and leaves redo or already handled shortcuts alone", () => {
    const event = { key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
    expect(isChartUndoKey(event)).toBe(true);
    expect(isChartUndoKey({ ...event, key: "Z", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isChartUndoKey({ ...event, shiftKey: true })).toBe(false);
    expect(isChartUndoKey({ ...event, defaultPrevented: true })).toBe(false);
    expect(isChartUndoKey({ ...event, altKey: true })).toBe(false);
    expect(isChartUndoKey({ ...event, ctrlKey: false })).toBe(false);
  });
});
