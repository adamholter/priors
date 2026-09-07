import { ImageResponse } from "next/og";
import type { Snapshot } from "@/data/types";
import { computeIndex, type IndexConfig } from "@/engine";

/** Share card: avatar, handle, index name, five bars, tiny frontier, wordmark. 1200x630. */
export async function renderShareCard(snapshot: Snapshot, index: IndexConfig, who: { name: string; handle?: string; avatarUrl?: string }, opts?: { accent?: string; surface?: string }) {
  const r = computeIndex(snapshot, index);
  const top = r.ranked.slice(0, 5);
  const max = top[0]?.score ?? 1;
  const color = new Map(snapshot.labs.map((l) => [l.id, l.color]));
  const accent = opts?.accent ?? "#2F4FB0", bg = opts?.surface ?? "#FBFBF9";
  const pts = r.ranked.filter((x) => x.costUsd && x.costUsd > 0);
  const xs = pts.map((p) => Math.log10(p.costUsd!)), ys = pts.map((p) => p.score);
  const [x0, x1] = [Math.min(...xs, 0), Math.max(...xs, 1)], [y0, y1] = [Math.min(...ys, 0) - 3, Math.max(...ys, 1) + 3];
  const W = 300, H = 220;
  const X = (v: number) => 10 + ((v - x0) / (x1 - x0 || 1)) * (W - 20), Y = (v: number) => H - 10 - ((v - y0) / (y1 - y0 || 1)) * (H - 20);
  const frontier = pts.filter((p) => p.onFrontier).sort((a, b) => a.costUsd! - b.costUsd!);
  const [serif, sans, mono] = await Promise.all([font("Newsreader", "wght@400"), font("Inter", "wght@400;500"), font("JetBrains+Mono", "wght@400")]);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, background: bg, color: "#1A1A1A", display: "flex", padding: "56px 64px", fontFamily: "Inter", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {who.avatarUrl ? <img src={who.avatarUrl} width={56} height={56} style={{ borderRadius: 28, border: "1px solid #DDDBD4" }} alt="" /> : <div style={{ width: 56, height: 56, borderRadius: 28, background: "#ECEAE3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Newsreader", fontSize: 28, color: "#4A4A46" }}>{who.name[0] ?? "?"}</div>}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26, fontWeight: 500 }}>{who.name}</div>
              {who.handle && <div style={{ fontSize: 18, color: "#8A8A80", fontFamily: "JetBrains Mono" }}>{`priors.so/${who.handle}`}</div>}
            </div>
          </div>
          <div style={{ fontFamily: "Newsreader", fontSize: 52, marginTop: 36, marginBottom: 28, letterSpacing: -0.5 }}>{index.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {top.map((t) => (
              <div key={t.variant.id} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 21 }}>
                <div style={{ width: 300, display: "flex", alignItems: "baseline", gap: 8, whiteSpace: "nowrap", overflow: "hidden" }}>{t.model.name}{t.variant.effort !== "default" && <span style={{ fontFamily: "JetBrains Mono", fontSize: 15, color: "#8A8A80" }}>{t.variant.effort}</span>}</div>
                <div style={{ flex: 1, height: 16, background: "#ECEAE3", borderRadius: 3, display: "flex" }}><div style={{ width: `${(t.score / max) * 100}%`, height: 16, background: color.get(t.model.labId) ?? "#A3A39B", borderRadius: 3 }} /></div>
                <div style={{ width: 70, textAlign: "right", fontFamily: "JetBrains Mono", fontSize: 20 }}>{t.score.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 300, marginLeft: 48, display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 92 }}>
          {pts.length > 2 && (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke="#DDDBD4" />
              <polyline points={frontier.map((p) => `${X(Math.log10(p.costUsd!))},${Y(p.score)}`).join(" ")} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />
              {pts.map((p) => <circle key={p.variant.id} cx={X(Math.log10(p.costUsd!))} cy={Y(p.score)} r={5} fill={color.get(p.model.labId) ?? "#A3A39B"} stroke={p.onFrontier ? "#1A1A1A" : bg} strokeWidth={1.5} />)}
            </svg>
          )}
          <div style={{ fontSize: 13, color: "#8A8A80", fontFamily: "JetBrains Mono", marginTop: 8 }}>{pts.length > 2 ? "score vs cost per task" : ""}</div>
        </div>
        <div style={{ position: "absolute", right: 64, bottom: 48, fontFamily: "Newsreader", fontSize: 38, letterSpacing: -0.5, display: "flex" }}><span>pr</span><span style={{ color: accent }}>i</span><span>ors</span></div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: "Newsreader", data: serif, style: "normal" }, { name: "Inter", data: sans, style: "normal" }, { name: "JetBrains Mono", data: mono, style: "normal" }] },
  );
}

const cache = new Map<string, Promise<ArrayBuffer>>();
function font(family: string, axis: string): Promise<ArrayBuffer> {
  const key = family + axis;
  if (!cache.has(key)) cache.set(key, (async () => {
    // Satori needs TTF/OTF; an empty UA makes Google Fonts serve truetype instead of woff2.
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axis}&display=swap`, { headers: { "User-Agent": "" } })).text();
    const url = css.match(/url\(([^)]+\.ttf)\)/)?.[1] ?? css.match(/src: url\(([^)]+)\) format\('(truetype|opentype)'\)/)?.[1];
    if (!url) throw new Error(`no font url for ${family}`);
    return (await fetch(url)).arrayBuffer();
  })());
  return cache.get(key)!;
}
