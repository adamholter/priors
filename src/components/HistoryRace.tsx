"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { placeAt, TOP, type HistoryData } from "@/lib/history-frames";
import { markColor, useChartPalette } from "./chart/echarts";

const ROW = 32, VIDEO_ROW = 40;
/** Snapshot-days per second at 1×: the whole six weeks in about half a minute. */
const BASE_SPEED = 1.4;
type Mode = "fixed" | "adapting";
const SPEEDS = [0.5, 1, 2, 4];

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const readIndex = (): string => {
  const fromUrl = new URL(window.location.href).searchParams.get("i");
  if (fromUrl) return fromUrl;
  try { const saved = JSON.parse(localStorage.getItem("priors:indices") ?? "[]") as string[]; return saved[0] ?? ""; } catch { return ""; }
};

/** Rankings through time: the top 20 on every snapshot date, played back in time or scrubbed by hand. */
export function HistoryRace({ video = false }: { video?: boolean }) {
  const [index, setIndex] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("fixed");
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState("");
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [back, setBack] = useState(true);
  const [speed, setSpeed] = useState(1);
  const pal = useChartPalette();
  const posRef = useRef(0);
  const place = useCallback((p: number) => { posRef.current = p; setPos(p); }, []);

  useEffect(() => { const id = requestAnimationFrame(() => { setIndex(readIndex()); if (new URL(window.location.href).searchParams.get("mode") === "adapting") setMode("adapting"); }); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    if (index === null) return;
    const ctrl = new AbortController();
    fetch(`/api/history?${new URLSearchParams({ ...(index ? { i: index } : {}), mode })}`, { signal: ctrl.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Couldn't load the history."); return j as HistoryData; })
      .then((d) => {
        const first = !data;
        setError("");
        setData(d);
        if (first) { place(d.frames.length - 1); setPlaying(!video && !matchMedia("(prefers-reduced-motion: reduce)").matches); }
      })
      .catch((e) => { if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Couldn't load the history."); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mode]);

  // Playback: advance by elapsed time, so frame rate never changes the pace.
  useEffect(() => {
    if (!playing || !data) return;
    const last = data.frames.length - 1;
    let raf = 0, t0 = performance.now();
    const tick = (now: number) => {
      const next = posRef.current + (back ? -1 : 1) * BASE_SPEED * speed * ((now - t0) / 1000);
      t0 = now;
      if (next <= 0 || next >= last) { place(next <= 0 ? 0 : last); setPlaying(false); return; }
      place(next); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, back, speed, data, place]);

  // The video render steps frames itself.
  useEffect(() => {
    if (!video || !data) return;
    const w = window as unknown as { __historySeek?: (p: number) => void; __historyReady?: boolean };
    w.__historySeek = (p) => { place(p * (data.frames.length - 1)); };
    w.__historyReady = true;
  }, [video, data, place]);

  const rows = useMemo(() => (data ? placeAt(data, pos) : []), [data, pos]);
  const labs = useMemo(() => new Map(data?.labs.map((l) => [l.id, l]) ?? []), [data]);
  const frame = data?.frames[Math.round(pos)];
  const same = !!data && data.frames.every((f) => f.used === f.of);

  const play = () => {
    if (!data) return;
    const last = data.frames.length - 1;
    if (back && pos <= 0) place(last); else if (!back && pos >= last) place(0);
    setPlaying((p) => !p);
  };
  const fmtEffort = (e: string) => (e === "default" ? "" : e);

  const rowH = video ? VIDEO_ROW : ROW;
  const chart = <div className="relative overflow-hidden" style={{ height: TOP * rowH }} role="img" aria-label={`Top ${TOP} on ${frame ? longDate(frame.date) : ""}`}>
    {data && rows.map((r) => {
      const [lo, hi] = data.domain, color = markColor(labs.get(r.labId)?.color, pal, r.labId);
      return <div key={r.id} className="absolute left-0 right-0 flex items-center gap-3" style={{ height: rowH, transform: `translateY(${r.y * rowH}px)`, opacity: r.opacity, willChange: "transform" }}>
        <span className="num text-grey text-[12px] w-6 text-right">{Math.round(r.y) + 1}</span>
        <span className={`text-right truncate ${video ? "w-[260px] text-[19px]" : "w-[120px] sm:w-[190px] text-[13px]"}`}>{r.name}<span className="text-grey"> {fmtEffort(r.effort)}</span></span>
        <span className="flex-1 min-w-0 relative" style={{ height: video ? 26 : 18 }}>
          <i className="absolute left-0 top-0 bottom-0 rounded-[3px]" style={{ width: `${Math.max(0, Math.min(1, (r.score - lo) / (hi - lo))) * 100}%`, background: color }} />
        </span>
        <span className={`num text-right ${video ? "w-14 text-[19px]" : "w-11 text-[13px]"}`}>{r.score.toFixed(1)}</span>
      </div>;
    })}
  </div>;

  const key = <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[12px] text-ink-2">
    {data?.labs.map((l) => <span key={l.id} className="inline-flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: markColor(l.color, pal, l.id) }} />{l.name}</span>)}
  </div>;

  if (video) return <div className="h-dvh w-dvw flex flex-col px-[6vw] py-[5vh] bg-bone overflow-hidden" style={{ fontSize: 16 }}>
    <div className="flex items-end justify-between mb-[2.5vh]">
      <div><h1 className="text-[44px] leading-none">AI model rankings, back in time</h1><p className="text-ink-2 text-[20px] mt-3">Top {TOP} by {data?.name ?? "index"}, one snapshot a day</p></div>
      <div className="num text-[56px] leading-none tabular-nums">{frame ? longDate(frame.date) : ""}</div>
    </div>
    <div className="flex-1 min-h-0 flex flex-col justify-center">{chart}</div>
    <div className="flex items-center justify-between text-[16px]">{key}<span className="text-grey">mypriors.com</span></div>
  </div>;

  const chip = (active: boolean) => `text-[12.5px] px-3 py-1.5 rounded-[4px] border ${active ? "border-ink bg-ink text-white" : "border-hair text-ink-2 hover:text-ink"}`;
  return <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-[34px] leading-tight">Rankings through time</h1>
        <p className="text-ink-2 text-[14px] mt-1">The top {TOP} on {data?.name ?? "your index"} on every snapshot date{data ? `, ${shortDate(data.frames[0].date)} to ${shortDate(data.frames[data.frames.length - 1].date)}` : ""}.</p>
      </div>
      <div className="num text-[30px] leading-none tabular-nums" aria-live="off">{frame ? longDate(frame.date) : ""}</div>
    </div>
    {error ? <p className="text-danger text-[14px] py-10">{error}</p> : !data ? <p className="text-grey text-[14px] py-10">Loading rankings for every date…</p> : <>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button type="button" className="btn inline-flex items-center gap-1.5" onClick={play} aria-label={playing ? "Pause" : "Play"}>{playing ? <IconPlayerPauseFilled size={14} /> : <IconPlayerPlayFilled size={14} />}{playing ? "Pause" : "Play"}</button>
        <span className="flex gap-1" role="group" aria-label="Direction"><button type="button" className={chip(back)} onClick={() => setBack(true)}>Back in time</button><button type="button" className={chip(!back)} onClick={() => setBack(false)}>Forward</button></span>
        <span className="flex gap-1" role="group" aria-label="Speed">{SPEEDS.map((s) => <button key={s} type="button" className={chip(speed === s)} onClick={() => setSpeed(s)}>{s}×</button>)}</span>
        <span className="flex gap-1 sm:ml-auto" role="group" aria-label="Index over time">
          <button type="button" className={chip(mode === "fixed")} onClick={() => setMode("fixed")} title="Today's index exactly as written, scored on each day's data">Fixed index</button>
          <button type="button" className={chip(mode === "adapting")} onClick={() => setMode("adapting")} title="Each day drops benchmarks that fewer than 8 models had scores for">Adapting index</button>
        </span>
      </div>
      {chart}
      <div className="mt-5">
        <input type="range" className="w-full" min={0} max={data.frames.length - 1} step={0.01} value={pos} onChange={(e) => { setPlaying(false); place(Number(e.target.value)); }} aria-label="Date" aria-valuetext={frame ? longDate(frame.date) : undefined} />
        <div className="flex justify-between cap"><span>{shortDate(data.frames[0].date)}</span><span>{shortDate(data.frames[data.frames.length - 1].date)}</span></div>
      </div>
      {key}
      <p className="text-ink-2 text-[12.5px] mt-5 leading-relaxed">
        {mode === "fixed" ? "Fixed: your index as it is today, with each day's scores. A benchmark that wasn't published yet that day has no scores, so the others carry the ranking." : "Adapting: each day leaves out benchmarks that fewer than 8 models had scores for, so the index follows what was established by then."}
        {same && mode === "adapting" ? " Every benchmark in this index was well covered on every date, so it matches the fixed view." : ""}
        {frame && frame.used < frame.of ? ` On ${shortDate(frame.date)}, ${frame.used} of ${frame.of} benchmarks had enough scores.` : ""}
        {" "}<Link className="underline underline-offset-2 hover:text-ink" href={index ? `/?i=${encodeURIComponent(index)}` : "/"}>Open this index in the builder</Link>
      </p>
    </>}
  </div>;
}
