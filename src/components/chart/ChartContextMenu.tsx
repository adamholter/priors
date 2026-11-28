"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconExternalLink, IconEyeOff, IconStar, IconStarFilled } from "@tabler/icons-react";
import type { ECharts } from "echarts";
import { useChartPalette } from "./echarts";
import { featuredPoints, type ScatterPoint } from "./scatter-option";
import { chartLabel } from "@/lib/metrics";
import { useHighlight, togglePoint } from "./highlight";
import { LabLogo } from "@/components/LabLogo";
import { EMPTY_HIDDEN, hideChartPoint, visiblePoints, readChartHidden, setChartHidden, type ChartHidden } from "./chart-visibility";
import { chartUndo, listenForChartUndo } from "./chart-undo";
import { menuPlace, undoLabel, type ChartShareHandle } from "./chart-share";
import type { ChartLinkParams } from "./ChartLink";
import { ChartRows, UndoRow, letterKeys, splitKeys, type Acts } from "./share-rows";
import { menuKeys, usePresence } from "./share-ui";
import { chartLinkUrl } from "@/lib/highlight-link";
import "./chart-share.css";

type MenuState = { x: number; y: number; point?: ScatterPoint };

const VISIBILITY_EVENT = "priors:chart-visibility";
function subscribeVisibility(change: () => void) {
  window.addEventListener(VISIBILITY_EVENT, change);
  window.addEventListener("popstate", change);
  return () => { window.removeEventListener(VISIBILITY_EVENT, change); window.removeEventListener("popstate", change); };
}
function persistVisibility(anchor: string, hidden: ChartHidden, target?: ChartLinkParams) {
  const url = target ? chartLinkUrl(window.location.href, anchor, target) : new URL(window.location.href);
  window.history.replaceState(window.history.state, "", setChartHidden(url, anchor, hidden));
  window.dispatchEvent(new Event(VISIBILITY_EVENT));
}

export function useChartVisibility(allPoints: ScatterPoint[], anchor: string, params: ChartLinkParams = {}) {
  const encoded = useSyncExternalStore(subscribeVisibility, () => JSON.stringify(readChartHidden(new URL(window.location.href).searchParams, anchor)), () => JSON.stringify(EMPTY_HIDDEN));
  const hidden: ChartHidden = useMemo(() => JSON.parse(encoded), [encoded]);
  const [undoCount, setUndoCount] = useState(0);
  const owner = useRef({});
  useEffect(() => {
    const id = owner.current, stop = listenForChartUndo();
    const restored = readChartHidden(new URL(window.location.href).searchParams, anchor);
    // A reloaded chart can also undo its saved removals.
    if (restored.models.length || restored.efforts.length) chartUndo.record(id, () => persistVisibility(anchor, EMPTY_HIDDEN));
    return () => { chartUndo.forget(id); stop(); };
  }, [anchor]);
  const points = useMemo(() => visiblePoints(allPoints, hidden), [allPoints, hidden]);
  return {
    points, hidden, hiddenCount: allPoints.length - points.length, canUndo: undoCount > 0 || hidden.models.length > 0 || hidden.efforts.length > 0,
    hide: (p: ScatterPoint, wholeModel = false) => {
      chartUndo.record(owner.current, () => { persistVisibility(anchor, hidden); setUndoCount(n => Math.max(0, n - 1)); });
      persistVisibility(anchor, hideChartPoint(hidden, p, wholeModel), params);
      setUndoCount(n => n + 1);
    },
    undo: () => { if (!chartUndo.undo(owner.current)) persistVisibility(anchor, EMPTY_HIDDEN); },
    /** Bring models or efforts back (the chart key's list). One step on the undo stack, like a removal. */
    restore: (next: ChartHidden | ((now: ChartHidden) => ChartHidden)) => {
      // Read the URL, not the render: a restore can run a moment after the click that asked for it.
      const now = readChartHidden(new URL(window.location.href).searchParams, anchor);
      chartUndo.record(owner.current, () => persistVisibility(anchor, now)); persistVisibility(anchor, typeof next === "function" ? next(now) : next); setUndoCount(0);
    },
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

/** What each chart's menu hid last (by chart name), so Undo can say what it brings back. */
const lastHidden = new Map<string, string>();

/** The right-click, Context Menu key and long-press menu: the dot's own actions first, then the chart's (the same ones as the toolbar, each with its letter). */
export function ChartContextMenu({ state, close, name, points, visibility, chart, wrap, expanded, anchor, exportControl }: {
  state: MenuState | null; close: () => void; name: string; points: ScatterPoint[];
  visibility: ReturnType<typeof useChartVisibility>; chart: RefObject<ECharts | null>;
  wrap: RefObject<HTMLDivElement | null>; expanded: boolean; anchor?: string;
  exportControl: RefObject<ChartShareHandle | null>;
}) {
  const pal = useChartPalette(), hl = useHighlight(), router = useRouter();
  // Keep the last menu while it fades out.
  const [last, setLast] = useState<MenuState | null>(state);
  if (state && state !== last) setLast(state);
  const { mounted, shown } = usePresence(!!state, 90);
  const menu = state ?? last;
  const root = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  // Once nothing is hidden the remembered name is stale: a later hide through the chart key must not borrow it.
  useEffect(() => { if (!visibility.hiddenCount) lastHidden.delete(name); }, [visibility.hiddenCount, name]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!state || !el) return;
    // Measure at rest: the entry transform shrinks the box and would leave it past the gutter.
    el.style.transform = "none";
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    el.style.removeProperty("transform");
    setPos(menuPlace(state.x, state.y, r.width, r.height, vw, innerHeight));
  }, [state]);
  useLayoutEffect(() => {
    if (!state || !root.current) return;
    const from = document.activeElement as HTMLElement | null;
    returnFocus.current = from;
    chart.current?.dispatchAction({ type: "hideTip" });
    // Opened from the keyboard: focus the first row. A pointer open leaves focus alone, so no ring appears.
    if (from?.matches?.(":focus-visible")) root.current.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
  }, [state, chart]);
  useEffect(() => {
    if (!state) return;
    const dismiss = () => closeRef.current();
    const pointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) dismiss(); };
    const scroll = (e: Event) => { if (!root.current?.contains(e.target as Node)) dismiss(); };
    // A pointer open keeps focus on the chart: arrows, letters and Escape still work.
    const key = (e: KeyboardEvent) => {
      if (root.current?.contains(document.activeElement)) return;
      // Stop the key here: the chart's own single-key listener would run the same action a second time.
      if (e.key === "Escape") { e.stopPropagation(); dismiss(); }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const row = root.current?.querySelector<HTMLButtonElement>(`[data-key="${e.key.toLowerCase()}"]:not(:disabled)`);
        if (row) { e.preventDefault(); e.stopPropagation(); row.click(); }
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); const items = root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'); (e.key === "ArrowUp" || e.key === "End" ? items?.[items.length - 1] : items?.[0])?.focus(); }
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", pointer, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    return () => { document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", pointer, true); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", dismiss); };
  }, [state]);

  // Long-press opens the same menu on touch screens (iOS has no contextmenu event): a synthetic one, so the chart's own handler decides dot or chart.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let timer = 0, sx = 0, sy = 0;
    const cancel = () => clearTimeout(timer);
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !(e.target as Element).closest('[role="img"]')) return;
      sx = e.clientX; sy = e.clientY; clearTimeout(timer);
      timer = window.setTimeout(() => {
        navigator.vibrate?.(6);
        const target = document.elementFromPoint(sx, sy) ?? el;
        target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 2 }));
      }, 450);
    };
    const move = (e: PointerEvent) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", cancel); el.addEventListener("pointercancel", cancel);
    return () => { cancel(); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", cancel); el.removeEventListener("pointercancel", cancel); };
  }, [wrap]);

  if (!menu || !mounted) return null;
  const handle = exportControl.current, point = menu.point, hidden = visibility.hiddenCount, rows = handle?.rows() ?? -1;
  const starred = !!point && !!hl && featuredPoints(points, hl.items).some((p) => p.r.variant.id === point.r.variant.id);
  const acts: Acts = {
    native: !!handle?.native, empty: rows === 0, rows, formats: handle?.formats ?? ["png", "svg"],
    copyImage: () => { void handle?.copyImage(); },
    copyLink: anchor ? () => { void handle?.copyLink(); } : undefined,
    download: (f) => { void handle?.download(f); },
    edit: handle?.edit,
    expand: () => wrap.current?.querySelector<HTMLButtonElement>("button[data-chart-expand]")?.click(),
    expanded,
    undo: visibility.canUndo ? { run: visibility.undo, label: undoLabel(hidden, lastHidden.get(name)) } : undefined,
    done: close,
  };
  const ic = { size: 16, stroke: 1.6, "aria-hidden": true as const };
  const style = { ...pos, "--white": pal.tipBg, "--ink": pal.ink, "--ink-2": pal.ink2, "--hair": pal.tipBorder, "--grey": pal.grey, "--bone": pal.bg } as CSSProperties;
  const hide = (wholeModel: boolean) => { if (!point) return; lastHidden.set(name, wholeModel ? point.r.model.name : chartLabel(point.r)); visibility.hide(point, wholeModel); };

  function keyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); close(); returnFocus.current?.focus(); return; }
    if (splitKeys(e) || letterKeys(e, root.current)) return;
    menuKeys(e, root.current);
  }

  const title = point
    ? <div className="chart-context-title chart-context-title-dot"><LabLogo lab={point.r.model.labId} name={point.r.model.name} color={hl?.models.find((m) => m.id === point.r.model.id)?.color} size={14} /><span>{chartLabel(point.r)}</span></div>
    : <div className="chart-context-title"><span>{name}</span></div>;

  return createPortal(<div ref={root} role="menu" aria-label={`${name} chart actions`} className="chart-context-menu" data-shown={shown || undefined} style={style} onKeyDown={keyDown} onContextMenu={(e) => e.preventDefault()}>
    {title}
    {point && <>
      {hl && <button role="menuitem" type="button" className="chart-context-row" onClick={() => { close(); hl.set(togglePoint(hl.items, points, point)); }}>
        {starred ? <IconStarFilled size={16} aria-hidden="true" /> : <IconStar {...ic} />}<span className="chart-context-label">{starred ? "Remove highlight" : "Highlight"}</span>
      </button>}
      <button role="menuitem" type="button" className="chart-context-row" onClick={() => { close(); hide(false); }}><IconEyeOff {...ic} /><span className="chart-context-label">Hide effort</span></button>
      <button role="menuitem" type="button" className="chart-context-row" onClick={() => { close(); hide(true); }}><IconEyeOff {...ic} /><span className="chart-context-label">Hide model</span></button>
      <button role="menuitem" type="button" className="chart-context-row" onClick={() => { close(); router.push(`/models/${point.r.model.id}`); }}><IconExternalLink {...ic} /><span className="chart-context-label">Open model</span></button>
    </>}
    {acts.undo && <div className={point ? "chart-context-section" : undefined}><UndoRow a={acts} /></div>}
    <div className={point || acts.undo ? "chart-context-section" : undefined}><ChartRows a={acts} /></div>
  </div>, document.body);
}
