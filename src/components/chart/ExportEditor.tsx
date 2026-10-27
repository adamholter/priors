"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ECharts } from "echarts";
import { IconCheck, IconLink, IconX } from "@tabler/icons-react";
import { PAGE_PRESETS, THEME_CHOICES, themeById } from "@/lib/page-presets";
import { EDITOR_MAX, EDITOR_MIN, EDITOR_RATIOS, clampSize, ratioOf, type EditorState, type EditorView } from "@/lib/export-editor";
import { labelScale } from "./label-size";
import { ChartPaletteContext, paletteFor, useChartPalette } from "./echarts";
import { ChartExport } from "./ChartExport";
import type { ScatterView } from "./scatter-option";

const THEMES = [{ id: "site", name: "Current page" }, ...[...THEME_CHOICES, PAGE_PRESETS.find((p) => p.id === "night")!].map((p) => ({ id: p.id, name: p.name }))];

/**
 * The screenshot editor: the chart at the size of the image, resizable by dragging its corner or by ratio, with its own
 * theme, title and chart settings. Everything it holds goes into the link (`xe`), so the link opens this modal over the same page.
 */
export default function ExportEditor({ name, initial, base, showScale, onClose, link, plot }: {
  name: string; initial: EditorState; base: ScatterView; showScale: boolean; onClose: () => void;
  link: (state: EditorState) => string;
  plot: (view: ScatterView, height: number, chartRef: { current: ECharts | null }) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null), chartRef = useRef<ECharts | null>(null);
  const [size, setSize] = useState(() => clampSize(initial.w, initial.h));
  const [ratio, setRatio] = useState(initial.ratio ?? "free");
  const [theme, setTheme] = useState(initial.theme ?? "site");
  const [title, setTitle] = useState(initial.title ?? "");
  const [over, setOver] = useState<EditorView>(initial.view ?? {});
  const [copied, setCopied] = useState(false);
  const site = useChartPalette();
  const preset = theme === "site" ? undefined : themeById(theme);
  const pal = preset ? paletteFor(preset) : site;
  const view: ScatterView = { ...base };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) (view as unknown as Record<string, unknown>)[k] = v;
  const set = (patch: EditorView) => setOver((o) => ({ ...o, ...patch }));
  const state = (): EditorState => ({ ...size, ratio, theme: theme === "site" ? undefined : theme, title: title.trim() || undefined, view: over });

  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal(); }, []);

  const lock = ratioOf(ratio);
  const resize = (w: number, h?: number) => setSize(clampSize(w, lock ? w / lock : h ?? size.h));
  const pickRatio = (id: string) => { setRatio(id); const r = ratioOf(id); if (r) setSize(clampSize(size.w, size.w / r)); };
  const drag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const x0 = e.clientX, y0 = e.clientY, { w, h } = size;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => setSize(clampSize(w + m.clientX - x0, lock ? (w + m.clientX - x0) / lock : h + m.clientY - y0));
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  const copy = async () => {
    const url = link(state());
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { window.history.replaceState(null, "", url); }
  };

  const heading = title.trim() || name;
  return <dialog ref={dialog} className="xe" aria-label={`Edit ${name} screenshot`} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <ChartPaletteContext.Provider value={pal}>
      <div className="xe-stage">
        <div className="xe-card" style={{ background: pal.bg, color: pal.ink }}>
          <div className="xe-title" style={{ fontFamily: "Newsreader, Georgia, serif", color: pal.ink }}>{heading}</div>
          <div className="xe-box" style={{ width: size.w, height: size.h }} data-testid="xe-box">
            {plot(view, size.h, chartRef)}
            <button type="button" className="xe-grip" aria-label="Drag to resize" title="Drag to resize" onPointerDown={drag} style={{ color: pal.grey }} />
          </div>
          <div className="xe-foot" style={{ color: pal.grey }}>mypriors.com</div>
        </div>
      </div>
    </ChartPaletteContext.Provider>
    <aside className="xe-side">
      <header><h2>Edit screenshot</h2><button type="button" onClick={onClose} aria-label="Close editor"><IconX size={16} aria-hidden="true" /></button></header>
      <section>
        <h3>Shape</h3>
        <div className="xe-row" role="group" aria-label="Aspect ratio">{EDITOR_RATIOS.map((r) => <button key={r.id} type="button" aria-pressed={ratio === r.id} onClick={() => pickRatio(r.id)}>{r.label}</button>)}</div>
        <div className="xe-size">
          <label>Width<input type="number" min={EDITOR_MIN.w} max={EDITOR_MAX} value={size.w} onChange={(e) => resize(Number(e.target.value) || size.w)} /></label>
          <label>Height<input type="number" min={EDITOR_MIN.h} max={EDITOR_MAX} value={size.h} disabled={!!lock} onChange={(e) => resize(size.w, Number(e.target.value) || size.h)} /></label>
        </div>
      </section>
      <section>
        <h3>Look</h3>
        <label className="xe-field">Theme<select value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="xe-field">Title<input type="text" value={title} maxLength={120} placeholder={name} onChange={(e) => setTitle(e.target.value)} /></label>
      </section>
      <section>
        <h3>Chart</h3>
        {showScale && <label className="xe-field">Scale<select value={view.scale ?? "log"} onChange={(e) => set({ scale: e.target.value as "log" | "linear" })}><option value="log">Log</option><option value="linear">Linear</option></select></label>}
        <label className="xe-check"><input type="checkbox" checked={!!view.frontier} onChange={(e) => set({ frontier: e.target.checked })} />Pareto frontier</label>
        <label className="xe-check"><input type="checkbox" checked={!!view.links} onChange={(e) => set({ links: e.target.checked })} />Effort lines</label>
        <label className="xe-check"><input type="checkbox" checked={view.guides !== false} onChange={(e) => set({ guides: e.target.checked })} />Guide lines</label>
        <label className="xe-field">Labels <span>{view.density === 0 ? "Frontier only" : view.density === 1 ? "All" : `${Math.round(view.density * 100)}%`}</span><input type="range" min={0} max={1} step={0.05} value={view.density} onChange={(e) => set({ density: Number(e.target.value) })} /></label>
        <label className="xe-field">Label size <span>{Math.round(labelScale(view.labelScale) * 100)}%</span><input type="range" min={75} max={175} step={5} value={Math.round(labelScale(view.labelScale) * 100)} onChange={(e) => set({ labelScale: Number(e.target.value) / 100 })} /></label>
      </section>
      <footer>
        <ChartPaletteContext.Provider value={pal}><ChartExport name={name} title={heading} frame trim={false} getSvg={() => chartRef.current?.renderToSVGString()} /></ChartPaletteContext.Provider>
        <button type="button" className="xe-copy" onClick={copy}>{copied ? <IconCheck size={14} aria-hidden="true" /> : <IconLink size={14} aria-hidden="true" />}{copied ? "Link copied" : "Copy link"}</button>
      </footer>
    </aside>
  </dialog>;
}
