import { expect, it } from "vitest";
import { labelScale, linkedLabelScale } from "./label-size";

it("bounds saved and linked label sizes while preserving the existing default", () => {
  expect(labelScale(undefined)).toBe(1);
  expect(labelScale(NaN)).toBe(1);
  expect(labelScale(0.2)).toBe(0.75);
  expect(labelScale(5)).toBe(1.75);
  expect(linkedLabelScale(new URLSearchParams("ls=125"))).toBe(1.25);
  for (const query of ["", "ls=", "ls=bad", "ls=Infinity"]) expect(linkedLabelScale(new URLSearchParams(query))).toBeUndefined();
});
