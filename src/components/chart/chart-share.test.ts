import { describe, expect, it } from "vitest";
import { LIGHT_PALETTE } from "./palette";
import { fileStem, fingerprint, framedSvg, menuPlace, plotAction, rowsHint, toCsv, undoLabel } from "./chart-share";

describe("toCsv", () => {
  it("takes columns from every row, in first-seen order, and leaves gaps empty", () => {
    expect(toCsv([{ a: 1, b: "x" }, { a: 2, c: true }])).toBe("a,b,c\n1,x,\n2,,true");
  });
  it("quotes commas, quotes and newlines, and writes null as empty", () => {
    expect(toCsv([{ name: 'He said "hi", twice', note: "a\nb", none: null }])).toBe('name,note,none\n"He said ""hi"", twice","a\nb",');
  });
  it("is an empty string with no rows", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("fileStem", () => {
  it("names a file after the chart", () => {
    expect(fileStem("Score vs subscription cost per task")).toBe("priors-score-vs-subscription-cost-per-task");
    expect(fileStem("Time / task (log)")).toBe("priors-time-task-log-");
  });
});

describe("rowsHint", () => {
  it("counts rows with a thousands separator and says nothing for a chart with none to export", () => {
    expect(rowsHint(55)).toBe("55 rows");
    expect(rowsHint(1)).toBe("1 row");
    expect(rowsHint(0)).toBe("0 rows");
    expect(rowsHint(1234)).toBe("1,234 rows");
    expect(rowsHint(-1)).toBe("");
  });
});

describe("fingerprint", () => {
  it("differs when the picture differs and repeats when it does not", () => {
    expect(fingerprint("<svg>a</svg>")).toBe(fingerprint("<svg>a</svg>"));
    expect(fingerprint("<svg>a</svg>")).not.toBe(fingerprint("<svg>b</svg>"));
    expect(fingerprint("")).toBe("0:5381");
  });
});

describe("undoLabel", () => {
  it("names the last thing hidden, counts when several are, and falls back to plain words", () => {
    expect(undoLabel(1, "Sonnet 5.5 xhigh")).toBe("Undo hide Sonnet 5.5 xhigh");
    expect(undoLabel(3, "Sonnet 5.5 xhigh")).toBe("Undo hide (3)");
    expect(undoLabel(1)).toBe("Undo hide");
    expect(undoLabel(0)).toBe("Undo hide");
  });
});

describe("menuPlace", () => {
  it("opens just under the pointer when there is room", () => {
    expect(menuPlace(300, 200, 240, 300, 1440, 900)).toEqual({ left: 300, top: 202 });
  });
  it("shifts left to keep an 8px gutter at the right edge", () => {
    expect(menuPlace(1400, 200, 240, 300, 1440, 900).left).toBe(1440 - 240 - 8);
  });
  it("slides up to stay on screen, so the pointer stays inside the menu", () => {
    expect(menuPlace(300, 800, 240, 300, 1440, 900).top).toBe(900 - 300 - 8);
  });
  it("never leaves the top or left gutter, even when the menu is taller than the screen", () => {
    expect(menuPlace(2, 2, 240, 2000, 1440, 900)).toEqual({ left: 8, top: 8 });
  });
});

describe("plotAction", () => {
  it("maps the single keys of a focused plot", () => {
    expect(plotAction("c", false)).toBe("copy");
    expect(plotAction("S", false)).toBe("save");
    expect(plotAction("l", false)).toBe("link");
    expect(plotAction("e", false)).toBe("edit");
    expect(plotAction("x", false)).toBe("expand");
    expect(plotAction("q", false)).toBeNull();
  });
  it("lets Cmd or Ctrl copy the image but leaves every other browser shortcut alone", () => {
    expect(plotAction("c", true)).toBe("copy");
    for (const k of ["s", "l", "e", "x"]) expect(plotAction(k, true)).toBeNull();
  });
});

describe("framedSvg", () => {
  const svg = '<svg width="400" height="200" style="font-family: var(--font-sans), Inter"><text>hi</text></svg>';
  it("is undefined while the chart has not drawn", () => {
    expect(framedSvg({ name: "x", getSvg: () => undefined }, LIGHT_PALETTE)).toBeUndefined();
  });
  it("drops page font variables an exported image cannot resolve", () => {
    const out = framedSvg({ name: "x", trim: false, getSvg: () => svg }, LIGHT_PALETTE);
    expect(out).toBe('<svg width="400" height="200" style="font-family: Inter"><text>hi</text></svg>');
  });
  it("frames the chart under its title when asked", () => {
    const out = framedSvg({ name: "Cost", title: "Cost per task", frame: true, trim: false, getSvg: () => svg }, LIGHT_PALETTE) ?? "";
    expect(out).toContain("Cost per task");
    expect(out).toContain("mypriors.com");
  });
});
