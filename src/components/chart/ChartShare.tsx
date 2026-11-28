"use client";
/* eslint-disable @next/next/no-img-element -- the drag ghost is a data URL of the chart itself */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type Ref } from "react";
import { IconBrush, IconCopy, IconDownload, IconLink, IconShare2 } from "@tabler/icons-react";
import { track } from "@/lib/analytics";
import { chartLinkUrl } from "@/lib/highlight-link";
import { copyLink } from "@/lib/short-link";
import { useChartPalette } from "./echarts";
import { useHighlight } from "./highlight";
import { useHashTarget, type ChartLinkParams } from "./ChartLink";
import { LOADING, SAVED, canShareFiles, fileStem, fingerprint, framedSvg, plotAction, renderPng, renderSvg, saveBlob, toCsv, type ChartExportFormat, type ChartShareHandle, type ExportRow, type ShareKind, type ShareSource } from "./chart-share";
import { FORMAT_ROWS } from "./share-rows";
import { Check, Chev, Label, Pop, Ring, Swap, usePop, useNames, type Say } from "./share-ui";
import "./chart-share.css";

export type { ChartExportFormat, ChartShareHandle, ExportRow };
export type ChartShareProps = Omit<ShareSource, "getSvg"> & {
  /** The chart as an SVG string. Without it only the link is offered (an empty leaderboard has nothing to draw). */
  getSvg?: () => string | undefined;
  /** The chart's anchor: shows Copy link, and scrolls to the chart when the page opens at it. */
  link?: { id: string; name: string; params?: ChartLinkParams };
  /** Opens the screenshot editor; shows a brush beside the copy button. */
  onEdit?: () => void;
  getRows?: () => ExportRow[]; getHtml?: () => string;
  ref?: Ref<ChartShareHandle>;
};

// A phone or tablet whose share sheet takes a PNG, and whether the pointer is a finger. Read after hydration so the server's markup matches.
let device: { native: boolean; coarse: boolean } | undefined;
const SERVER_DEVICE = { native: false, coarse: false };
const readDevice = () => (device ??= { native: canShareFiles(), coarse: window.matchMedia("(pointer: coarse)").matches });
const noSubscription = () => () => {};
const useDevice = () => useSyncExternalStore(noSubscription, readDevice, () => SERVER_DEVICE);

const noSvg = () => undefined;
type Prepared = { key: string; svg: string; promise: Promise<Blob>; blob?: Blob; file?: File };

/** The toolbar's actions: copy and save the image, copy the link, download the data, each confirmed in words. */
function useShare(p: ChartShareProps) {
  const pal = useChartPalette(), hl = useHighlight(), { native } = useDevice();
  const latest = useRef({ p: { ...p, getSvg: p.getSvg ?? noSvg }, pal, hl });
  useEffect(() => { latest.current = { p: { ...p, getSvg: p.getSvg ?? noSvg }, pal, hl }; });
  const [busy, setBusy] = useState<ShareKind | null>(null);
  const [slow, setSlow] = useState(false);
  const [said, setSaid] = useState<Say | null>(null);
  const timer = useRef(0), seq = useRef(0), prepared = useRef<Prepared | null>(null);
  // One copy or download at a time: a double click must not start two writes.
  const working = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  // A spinner only when the work takes longer than a blink.
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), 150);
    return () => { clearTimeout(t); setSlow(false); };
  }, [busy]);

  const flash = useCallback((kind: ShareKind, text: string, tone: Say["tone"] = "ok") => {
    clearTimeout(timer.current);
    setSaid({ id: ++seq.current, kind, text, tone });
    timer.current = window.setTimeout(() => setSaid(null), tone === "err" ? 4200 : 1800);
  }, []);

  /** Renders the PNG ahead (on hover, focus or first touch), so a drag can hand it over without waiting. Reused while the chart looks the same. */
  const prepare = useCallback((): Prepared | undefined => {
    const { p, pal } = latest.current;
    let svg: string | undefined;
    try { svg = framedSvg(p, pal); } catch { return undefined; }
    if (!svg) return undefined;
    const key = `${fingerprint(svg)}:${pal.bg}`;
    if (prepared.current?.key === key) return prepared.current;
    const first = svg;
    const promise = (async () => {
      // Text measured before the fonts load would trim the wrong width: draw again once they have.
      if (document.fonts.status === "loaded") return renderPng(first, pal.bg);
      await document.fonts.ready;
      const again = framedSvg(p, pal);
      if (!again) throw new Error(LOADING);
      return renderPng(again, pal.bg);
    })();
    const entry: Prepared = { key, svg, promise };
    prepared.current = entry;
    promise.then((blob) => { entry.blob = blob; entry.file = new File([blob], `${fileStem(p.name)}.png`, { type: "image/png" }); }, () => { if (prepared.current === entry) prepared.current = null; });
    return entry;
  }, []);

  const download = useCallback(async (format: ChartExportFormat) => {
    if (working.current) return;
    working.current = true;
    const { p, pal } = latest.current;
    setBusy(format); track("chart_exported", { chart: p.name, format });
    try {
      if (format === "html") { const html = p.getHtml?.(); if (!html) throw new Error(LOADING); saveBlob(new Blob([html], { type: "text/html;charset=utf-8" }), p.name, "html"); }
      else if (format === "csv" || format === "json") {
        const rows = p.getRows?.() ?? [];
        saveBlob(new Blob([format === "csv" ? toCsv(rows) : JSON.stringify({ name: p.name, rows }, null, 2)], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" }), p.name, format);
      } else if (format === "png") { const e = prepare(); if (!e) throw new Error(LOADING); saveBlob(await e.promise, p.name, "png"); }
      else saveBlob(await renderSvg(p, pal), p.name, "svg");
      flash(format, SAVED[format]);
    } catch (e) { flash(format, e instanceof Error ? e.message : "Export failed. Try again.", "err"); }
    finally { working.current = false; setBusy(null); }
  }, [flash, prepare]);

  /** Call straight from a click: Safari only lets the clipboard write start inside the gesture, so the PNG is handed over as a promise. On a phone it opens the share sheet instead. */
  const copyImage = useCallback(async (): Promise<boolean> => {
    if (working.current) return false;
    working.current = true;
    const { p } = latest.current;
    track("chart_exported", { chart: p.name, format: "copy" });
    setBusy("image");
    const entry = prepare();
    const png = entry?.promise ?? Promise.reject(new Error(LOADING));
    void png.catch(() => {});
    try {
      if (native) {
        // The share sheet needs the file ready inside the tap: it is rendered on first touch.
        const file = entry?.file ?? new File([await png], `${fileStem(p.name)}.png`, { type: "image/png" });
        try { await navigator.share({ files: [file] }); } catch (e) { if ((e as Error).name === "AbortError") return false; throw e; }
        return true;
      }
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      flash("image", SAVED.image);
      return true;
    } catch {
      // No clipboard for images here (or it said no): save the PNG instead and say so.
      try { saveBlob(await png, p.name, "png"); flash("image", "Saved a PNG instead", "err"); }
      catch (e) { flash("image", e instanceof Error ? e.message : "Couldn't copy. Try again.", "err"); }
      return false;
    } finally { working.current = false; setBusy(null); }
  }, [flash, native, prepare]);

  const copyLinkNow = useCallback(async () => {
    const { p, hl } = latest.current;
    if (!p.link) return;
    const url = chartLinkUrl(window.location.href, p.link.id, p.link.params, hl ?? undefined);
    window.history.replaceState(null, "", url.toString());
    setBusy("link");
    try { await copyLink(url.toString()); flash("link", SAVED.link); }
    catch { flash("link", "Couldn't copy. The address bar has the link.", "err"); }
    finally { setBusy(null); }
  }, [flash]);

  // A page that opens at ?c=<this chart> scrolls to it and mirrors the link into the address bar.
  const paramsRef = useRef(p.link?.params);
  useEffect(() => { paramsRef.current = p.link?.params; });
  useHashTarget(p.link?.id, undefined, p.link?.params ? paramsRef : undefined);

  const hasHtml = !!p.getHtml, hasRows = !!p.getRows, hasLink = !!p.link, hasEdit = !!p.onEdit;
  const formats = useMemo<ChartExportFormat[]>(() => ["png", "svg", ...(hasHtml ? (["html"] as const) : []), ...(hasRows ? (["csv", "json"] as const) : [])], [hasHtml, hasRows]);
  useImperativeHandle(p.ref, () => ({
    download, formats, copyImage, copyLink: copyLinkNow, hasLink, native,
    edit: hasEdit ? () => latest.current.p.onEdit?.() : undefined,
    rows: () => latest.current.p.getRows?.().length ?? -1,
  } satisfies ChartShareHandle), [download, formats, copyImage, copyLinkNow, hasLink, hasEdit, native]);

  /** The chart's link as someone else would open it, for dragging the link icon. */
  const linkHref = useCallback(() => {
    const { p, hl } = latest.current;
    return p.link ? chartLinkUrl(window.location.href, p.link.id, p.link.params, hl ?? undefined).toString() : undefined;
  }, []);

  return { pal, say: said, busy, slow, native, formats, flash, prepare, ready: () => prepared.current, linkHref, download, copyImage, copyLink: copyLinkNow, latest };
}

/** The chart's own Expand button, found from anywhere inside its toolbar. */
const expandButton = (from: Element | null) => from?.closest(".chart-toolbar")?.querySelector<HTMLButtonElement>("button[data-chart-expand]") ?? null;

/**
 * A chart header's share controls: copy link, copy the picture (also a handle to drag onto X, Slack or a folder), the screenshot brush, and a chevron
 * for the download and the data. With the plot focused, C copies the image, S saves it, L copies the link, E edits and X expands.
 */
export function ChartShare(props: ChartShareProps) {
  const p = props, c = useShare(p), pop = usePop(), names = useNames(), { coarse } = useDevice();
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [prep, setPrep] = useState(false);
  const [ghost, setGhost] = useState("");
  const ghostEl = useRef<HTMLImageElement>(null);
  const ghostKey = useRef(""), prepTimer = useRef(0), blobUrl = useRef("");
  useEffect(() => () => clearTimeout(prepTimer.current), []);
  const saved = c.say?.kind === "image" || c.say?.kind === "png";
  const err = saved && c.say?.tone === "err";

  // Single keys while the plot itself has focus (one listener on the chart's wrapper, never a timer).
  const share = useRef(c);
  useEffect(() => { share.current = c; });
  useEffect(() => {
    const wrap = root.current?.closest(".chart-toolbar")?.parentElement;
    if (!wrap) return;
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.shiftKey || !(e.target instanceof Element) || e.target !== wrap.querySelector('[role="img"][tabindex="0"]')) return;
      if (window.getSelection()?.toString()) return;
      const action = plotAction(e.key, e.metaKey || e.ctrlKey), now = share.current, { p } = now.latest.current;
      let run: (() => unknown) | undefined;
      if (action === "copy") run = now.copyImage;
      else if (action === "save") run = () => now.download("png");
      else if (action === "link" && p.link) run = now.copyLink;
      else if (action === "edit") run = p.onEdit;
      else if (action === "expand") run = expandButton(root.current)?.click.bind(expandButton(root.current));
      if (!run) return;
      e.preventDefault(); void run();
    };
    wrap.addEventListener("keydown", key);
    return () => wrap.removeEventListener("keydown", key);
  }, []);

  const warm = () => {
    const e = c.prepare();
    if (!e) return;
    // The drag picture is the framed chart itself, rebuilt only when the chart changed.
    if (ghostKey.current !== e.key) { ghostKey.current = e.key; setGhost(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(e.svg)}`); }
    if (!e.file) {
      clearTimeout(prepTimer.current);
      prepTimer.current = window.setTimeout(() => setPrep(true), 150);
      void e.promise.then(() => {}, () => {}).then(() => { clearTimeout(prepTimer.current); setPrep(false); });
    }
  };
  const onDragStart = (e: DragEvent) => {
    const ready = c.ready();
    if (!ready?.file || !ready.blob) { e.preventDefault(); c.flash("image", "Preparing image"); warm(); return; }
    const dt = e.dataTransfer;
    dt.effectAllowed = "copy";
    try { dt.items.add(ready.file); } catch { /* browsers without file drags still get the download hint */ }
    blobUrl.current = URL.createObjectURL(ready.blob);
    dt.setData("DownloadURL", `image/png:${ready.file.name}:${blobUrl.current}`);
    if (ghostEl.current?.complete) dt.setDragImage(ghostEl.current, 24, 16);
    setDrag(true); names.clear();
  };
  const onDragEnd = () => { setDrag(false); const u = blobUrl.current; if (u) setTimeout(() => URL.revokeObjectURL(u), 1000); blobUrl.current = ""; };
  const done = c.say?.kind === "link" && c.say.tone === "ok", linkErr = c.say?.kind === "link" && c.say.tone === "err";
  // The menu counts rows only while it is open: the toolbar never walks the data on a redraw.
  const rows = pop.open && p.getRows ? p.getRows().length : -1;
  const formats = FORMAT_ROWS.filter((f) => c.formats.includes(f.id));
  const empty = rows === 0;
  const copyName = names.bind(c.native ? "Share image" : "Copy image");

  const linkButton = p.link && <button type="button" className="chart-share-icon hit" aria-label={`Copy link to ${p.link.name}`} aria-busy={c.busy === "link" || undefined} onClick={() => { names.clear(); void c.copyLink(); }}
    draggable={!coarse} onDragStart={(e) => { const href = c.linkHref(); if (!href) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/uri-list", href); e.dataTransfer.setData("text/plain", href); names.clear(); }} {...names.bind("Copy link")}>
    <Swap on={done || linkErr} a={c.busy === "link" && c.slow ? <Ring size={15} /> : <IconLink size={16} stroke={1.6} aria-hidden="true" />} b={<Check size={16} tone={linkErr ? "danger" : undefined} />} />
  </button>;
  if (!p.getSvg) return <div className="chart-share" role="group" aria-label={`Share ${p.name}`}>{linkButton}<Label say={c.say} name={names.name} /></div>;

  return <div ref={root} className="chart-share" role="group" aria-label={`Share ${p.name}`}>
    {linkButton}
    <div className="chart-share-split" data-open={pop.open || undefined} aria-busy={!!c.busy || undefined}>
      <button type="button" className="chart-share-cell chart-share-copy hit" data-dragging={drag || undefined}
        aria-label={`${c.native ? "Share" : "Copy"} ${p.name} as an image`} draggable={!coarse} aria-busy={c.busy === "image" || undefined}
        onTouchStart={warm} onClick={() => { names.clear(); void c.copyImage(); }}
        onDragStart={onDragStart} onDragEnd={onDragEnd} {...copyName} onPointerEnter={(e) => { warm(); copyName.onPointerEnter(e); }} onFocus={(e) => { warm(); copyName.onFocus(e); }}>
        <Swap on={saved} a={(c.busy === "image" && c.slow) || (prep && !c.busy) ? <Ring size={15} /> : c.native ? <IconShare2 size={16} stroke={1.6} aria-hidden="true" /> : <IconCopy size={16} stroke={1.6} aria-hidden="true" />} b={<Check size={16} tone={err ? "danger" : undefined} />} />
      </button>
      {p.onEdit && <button type="button" className="chart-share-cell chart-share-brush hit" aria-label={`Edit ${p.name} screenshot`} onClick={p.onEdit} {...names.bind("Edit screenshot")}><IconBrush size={14} stroke={1.6} aria-hidden="true" /></button>}
      <button type="button" className="chart-share-cell chart-share-more hit" aria-haspopup="menu" aria-expanded={pop.open} aria-label={`Download ${p.name}`} onClick={(e) => { names.clear(); pop.toggle(e); }}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !pop.open) { e.preventDefault(); pop.show(true); } }} {...names.bind("Download")}><Chev /></button>
    </div>
    <Label say={c.say} name={pop.open ? null : names.name} />
    {ghost && <img ref={ghostEl} className="chart-share-ghost" src={ghost} alt="" width={220} aria-hidden="true" />}
    <Pop pop={pop} label={`Download ${p.name}`} className="chart-share-list">
      <button role="menuitem" type="button" className="chart-share-row" disabled={empty} onClick={() => { pop.close(); void c.download("png"); }}>
        <IconDownload size={16} stroke={1.6} aria-hidden="true" /><span>Download PNG</span>
      </button>
      {formats.map((f) => <button key={f.id} role="menuitem" type="button" className="chart-share-row" disabled={empty} onClick={() => { pop.close(); void c.download(f.id); }}>
        {f.icon}<span>{f.label}</span><span className="chart-share-hint">{f.hint({ rows })}</span>
      </button>)}
    </Pop>
  </div>;
}
