"use client";
import { useState } from "react";

export function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

/** Standalone vector or 3x raster export of the current chart, without UI controls. */
export function ChartExport({ name, getSvg }: { name: string; getSvg: () => string | undefined }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(format: "svg" | "png") {
    setBusy(true); setError("");
    try {
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `priors-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap justify-end items-center gap-2 mb-2" role="group" aria-label={`Export ${name}`}>
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" /></svg>
    <span className="cap">Export</span>
    {(["png", "svg"] as const).map(format => <button key={format} type="button" className="btn-quiet" disabled={busy} aria-label={`Download ${name} ${format.toUpperCase()}`} onClick={() => download(format)}>{format.toUpperCase()}</button>)}
    {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
  </div>;
}
