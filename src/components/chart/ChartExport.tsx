"use client";
import { useState } from "react";

export function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function toCsv(rows: ExportRow[]) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: ExportRow[string]) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))].join("\n");
}

/** Export control: PNG is the primary button, a chevron opens the full format menu (PNG, SVG, CSV, JSON). */
export function ChartExport({ name, getSvg, getRows }: { name: string; getSvg: () => string | undefined; getRows?: () => ExportRow[] }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  function save(blob: Blob, ext: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `priors-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function download(format: "svg" | "png" | "csv" | "json") {
    setOpen(false); setBusy(true); setError("");
    try {
      if (format === "csv" || format === "json") {
        const rows = getRows?.() ?? [];
        const text = format === "csv" ? toCsv(rows) : JSON.stringify({ name, rows }, null, 2);
        save(new Blob([text], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" }), format);
        return;
      }
      await document.fonts.ready;
      const raw = getSvg();
      if (!raw) throw new Error("Chart is still loading. Try again.");
      // Exports cannot inherit the page's CSS variables.
      const svg = raw.replace(/var\(--font-inter\),?\s*/g, "").replace(/var\(--font-jetbrains\),?\s*/g, "");
      let blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      if (format === "png") {
        const source = URL.createObjectURL(blob);
        try {
          const img = new Image(); img.src = source; await img.decode();
          const canvas = document.createElement("canvas");
          // Keep long expanded rankings within browser canvas limits.
          const scale = Math.min(3, 16000 / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Image export is unavailable.");
          ctx.fillStyle = "#FBFBF9"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Image export failed.")), "image/png"));
        } finally { URL.revokeObjectURL(source); }
      }
      save(blob, format);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed. Try again."); }
    finally { setBusy(false); }
  }
  const formats: ("png" | "svg" | "csv" | "json")[] = ["png", "svg", ...(getRows ? (["csv", "json"] as const) : [])];
  return <div className="relative flex flex-wrap justify-end items-center gap-2 mb-2" role="group" aria-label={`Export ${name}`}>
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" /></svg>
    <span className="cap">Export</span>
    <div className="export-split">
      <button type="button" disabled={busy} aria-label={`Download ${name} as PNG`} onClick={() => download("png")}>PNG</button>
      <button type="button" className="export-toggle" aria-haspopup="menu" aria-expanded={open} aria-label={`More export formats for ${name}`} onClick={() => setOpen(o => !o)}>
        <svg aria-hidden="true" width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3.8 5 6.8 8 3.8" /></svg>
      </button>
    </div>
    {open && <>
      <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close export menu" onClick={() => setOpen(false)} />
      <div className="export-menu" role="menu">
        {formats.map((format) => <button key={format} type="button" role="menuitem" disabled={busy} onClick={() => download(format)}>{format.toUpperCase()}</button>)}
      </div>
    </>}
    {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
  </div>;
}
