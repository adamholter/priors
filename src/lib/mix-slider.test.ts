import { describe, expect, it } from "vitest";
import { fromSlider, SLIDER_MAX, SLIDER_TOP, sliderUnit, toSlider } from "./mix-slider";

describe("mix sliders", () => {
  it("the unit is the middle weight, so an even mix sits mid-track", () => {
    const unit = sliderUnit({ a: 10, b: 10, c: 10, off: 0 });
    expect(unit).toBe(10);
    expect(toSlider(10, unit)).toBe(SLIDER_MAX / 2);
  });
  it("the unit grows when one weight would not fit on the track", () => {
    expect(sliderUnit({ a: 100, b: 10, c: 10 })).toBe(100 / SLIDER_TOP);
    expect(toSlider(100, sliderUnit({ a: 100, b: 10, c: 10 }))).toBe(SLIDER_MAX);
    expect(sliderUnit({})).toBe(10);
  });
  it("a position and its weight round-trip, and the right end is four units", () => {
    for (const p of [1, 17, 50, 83, 100]) expect(Math.round(toSlider(fromSlider(p, 18.6), 18.6))).toBe(p);
    expect(fromSlider(SLIDER_MAX, 10)).toBe(40);
    expect(fromSlider(0, 10)).toBe(0);
  });
});
