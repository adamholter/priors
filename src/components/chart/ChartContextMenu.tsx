"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject, type ReactNode, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { IconX, IconTrash, IconStar, IconStarFilled, IconArrowBackUp, IconCaretRightFilled } from "@tabler/icons-react";
import type { ECharts } from "echarts";
import { useChartPalette } from "./echarts";
import { featuredPoints, type ScatterPoint } from "./scatter-option";
import { chartLabel } from "@/lib/metrics";
import { useHighlight, togglePoint } from "./highlight";
import { EMPTY_HIDDEN, hideChartPoint, visiblePoints, type ChartHidden } from "./chart-visibility";
import { chartUndo, listenForChartUndo } from "./chart-undo";
import { ChartDownloadIcon, ChartExpandIcon, ChartLinkIcon } from "./ChartIcons";
import type { ChartExportHandle } from "./ChartExport";

export type ChartMenuDesign = "plain" | "icons" | "grouped";
export const ChartMenuDesignContext = createContext<ChartMenuDesign>("icons");
type MenuState = { x: number; y: number; point?: ScatterPoint };
type Action = { id: string; label: string; run: () => void; group: "point" | "chart" };

export function useChartVisibility(allPoints: ScatterPoint[]) {
  const [history, setHistory] = useState<ChartHidden[]>([EMPTY_HIDDEN]);
  const owner = useRef({});
  useEffect(() => {
    const id = owner.current, stop = listenForChartUndo();
    return () => { chartUndo.forget(id); stop(); };
  }, []);
  const hidden = history[history.length - 1];
  const points = useMemo(() => visiblePoints(allPoints, hidden), [allPoints, hidden]);
  return {
    points, hiddenCount: allPoints.length - points.length, canUndo: history.length > 1,
    hide: (p: ScatterPoint, wholeModel = false) => {
      chartUndo.record(owner.current, () => setHistory(h => h.length > 1 ? h.slice(0, -1) : h));
      setHistory(h => [...h, hideChartPoint(h[h.length - 1], p, wholeModel)]);
    },
    undo: () => { chartUndo.undo(owner.current); },
  };
}

/** The ECharts handler provides the selected data point; the DOM handler covers empty plot space. */
export function useChartContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  return {
    menu, close: () => setMenu(null),
    pointMenu: (point: ScatterPoint, x: number, y: number) => setMenu({ point, x, y }),
    onContextMenu: (event: ReactMouseEvent) => {
      event.preventDefault();
      const x = event.clientX, y = event.clientY;
      setMenu(current => current?.x === x && current.y === y ? current : { x, y });
    },
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      const r = event.currentTarget.getBoundingClientRect();
      setMenu({ x: r.left + 24, y: r.top + 24 });
    },
  };
}

export function ChartContextMenu({ state, close, name, points, visibility, chart, wrap, expanded, anchor, exportControl }: {
  state: MenuState | null; close: () => void; name: string; points: ScatterPoint[];
  visibility: ReturnType<typeof useChartVisibility>; chart: RefObject<ECharts | null>;
  wrap: RefObject<HTMLDivElement | null>; expanded: boolean; anchor?: string;
  exportControl: RefObject<ChartExportHandle | null>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [error, setError] = useState("");
  const [disclosure, setDisclosure] = useState<MenuState | null>(null);
  const formatsOpen = !!state && disclosure === state;
  const design = useContext(ChartMenuDesignContext), pal = useChartPalette(), hl = useHighlight();
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useLayoutEffect(() => {
    if (!state || !root.current) return;
    const r = root.current.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(state.x, document.documentElement.clientWidth - r.width - 8)), top: Math.max(8, Math.min(state.y, innerHeight - r.height - 8)) });
  }, [state, formatsOpen]);
  useLayoutEffect(() => {
    if (!state || !root.current) return;
    returnFocus.current = document.activeElement as HTMLElement;
    root.current.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus({ preventScroll: true });
    chart.current?.dispatchAction({ type: "hideTip" });
  }, [state, chart]);
  useEffect(() => {
    if (!state) return;
    const dismiss = () => closeRef.current();
    const pointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) dismiss(); };
    const scroll = (e: Event) => { if (!root.current?.contains(e.target as Node)) dismiss(); };
    document.addEventListener("pointerdown", pointer, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    return () => { document.removeEventListener("pointerdown", pointer, true); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", dismiss); };
  }, [state]);
  if (!state) return null;
  const clickControl = (label: string) => {
    const button = [...(wrap.current?.querySelectorAll<HTMLButtonElement>("button[aria-label]") ?? [])].find(b => b.getAttribute("aria-label") === label);
    button?.click();
  };
  const point = state.point;
  const starred = point && !!hl && featuredPoints(points, hl.items).some(p => p.r.variant.id === point.r.variant.id);
  const actions: Action[] = [];
  if (point) {
    actions.push({ id: "remove", label: "Remove", group: "point", run: () => visibility.hide(point) });
    actions.push({ id: "remove-model", label: "Remove model", group: "point", run: () => visibility.hide(point, true) });
    if (hl) actions.push({ id: "star", label: starred ? "Unstar" : "Star", group: "point", run: () => hl.set(togglePoint(hl.items, points, point)) });
  }
  if (visibility.canUndo) actions.push({ id: "undo", label: "Undo", group: "chart", run: visibility.undo });
  actions.push({ id: "export", label: "Export PNG", group: "chart", run: () => { void exportControl.current?.download("png"); } });
  if (anchor) actions.push({ id: "copy", label: "Copy chart link", group: "chart", run: () => clickControl(`Copy link to ${name}`) });
  actions.push({ id: "expand", label: expanded ? "Close expanded chart" : "Expand chart", group: "chart", run: () => clickControl(expanded ? `Close expanded ${name}` : `Expand ${name}`) });
  const iconProps = { size: 18, stroke: 1.6, "aria-hidden": true as const };
  const icon: Record<string, ReactNode> = {
    remove: <IconX {...iconProps} />, "remove-model": <IconTrash {...iconProps} />,
    star: starred ? <IconStarFilled size={18} aria-hidden="true" /> : <IconStar {...iconProps} />,
    undo: <IconArrowBackUp {...iconProps} />, export: <ChartDownloadIcon size={18} />,
    copy: <ChartLinkIcon size={18} />, expand: expanded ? <IconX {...iconProps} /> : <ChartExpandIcon size={18} />,
  };
  const style = { ...position, "--white": pal.tipBg, "--ink": pal.ink, "--ink-2": pal.ink2, "--hair": pal.tipBorder, "--grey": pal.grey, "--bone": pal.bg } as CSSProperties;
  function keyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); event.stopPropagation(); close(); returnFocus.current?.focus(); return; }
    if (event.key === "ArrowRight" && (document.activeElement?.hasAttribute("data-export-disclosure") || document.activeElement?.hasAttribute("data-export-png"))) {
      event.preventDefault(); setDisclosure(state);
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[data-export-format]')?.focus());
      return;
    }
    if (event.key === "ArrowLeft" && formatsOpen) {
      event.preventDefault(); setDisclosure(null);
      root.current?.querySelector<HTMLButtonElement>('[data-export-disclosure]')?.focus(); return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...root.current!.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')], at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
  return createPortal(<div ref={root} role="menu" aria-label={`${name} chart actions`} className={`chart-context-menu menu-${design}`} style={style} onKeyDown={keyDown} onContextMenu={e => e.preventDefault()}>
    <div className="chart-context-title">{point ? chartLabel(point.r) : name}</div>
    {actions.map((action, i) => <div key={action.id} className={i && actions[i - 1].group !== action.group ? "chart-context-section" : undefined}>
      {design === "grouped" && (i === 0 || actions[i - 1].group !== action.group) && <span className="chart-context-group">{action.group === "point" ? "Selection" : "Chart"}</span>}
      <div className={action.id === "export" ? "chart-context-export-row" : undefined}>
        <button role="menuitem" type="button" data-export-png={action.id === "export" || undefined} aria-keyshortcuts={action.id === "undo" ? "Control+Z Meta+Z" : undefined} onClick={() => { try { action.run(); close(); setError(""); } catch { setError("Action unavailable. Try again."); } }}>{design !== "plain" && <span className="chart-context-icon" aria-hidden="true">{icon[action.id]}</span>}<span>{action.label}</span>{action.id === "undo" && <kbd>Ctrl/⌘ Z</kbd>}</button>
        {action.id === "export" && <button role="menuitem" type="button" className="chart-context-disclosure" data-export-disclosure aria-label="Export formats" aria-haspopup="menu" aria-expanded={formatsOpen} onClick={() => setDisclosure(formatsOpen ? null : state)}><IconCaretRightFilled size={12} aria-hidden="true" /></button>}
      </div>
      {action.id === "export" && formatsOpen && <div role="menu" aria-label="Export formats" className="chart-context-formats">
        {exportControl.current?.formats.filter(format => format !== "png").map(format => <button key={format} role="menuitem" type="button" data-export-format={format} onClick={() => { void exportControl.current?.download(format); close(); }}>{format.toUpperCase()}</button>)}
      </div>}
    </div>)}
    {error && <p role="alert">{error}</p>}
  </div>, document.body);
}
