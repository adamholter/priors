/**
 * Renders the history page's bare stage (`/history?video=1`) to an MP4, stepping frames deterministically.
 * node scripts/history-video.mjs [baseUrl] [out.mp4] [seconds]
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const base = process.argv[2] ?? "http://localhost:3000", out = process.argv[3] ?? "priors-history.mp4", seconds = Number(process.argv[4] ?? 26);
const FPS = 30, HOLD = 1.5, W = 1920, H = 1080, total = Math.round((seconds + 2 * HOLD) * FPS);
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`${base}/history?video=1`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__historyReady, null, { timeout: 90000 });
const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
// Back in time: today first, the oldest snapshot last, with a held beat at each end and a gentle ease in and out.
const ease = (t) => t * t * (3 - 2 * t), mix = (t) => 0.7 * t + 0.3 * ease(t);
for (let n = 0; n < total; n++) {
  const t = Math.min(Math.max((n / FPS - HOLD) / seconds, 0), 1);
  await page.evaluate((p) => window.__historySeek(p), 1 - mix(t));
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("wrote", out);
