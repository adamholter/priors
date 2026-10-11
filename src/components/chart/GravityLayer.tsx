"use client";
import { useEffect, useRef } from "react";

export interface FallingDot { x: number; y: number; r: number; color: string; delay: number }

const HZ = 120, G = 2200 / (HZ * HZ), ITERATIONS = 4;

/**
 * Konami-code easter egg: chart marks that are off the Pareto frontier drop and pile up on the
 * x-axis. One canvas, position-based circle physics, and the loop stops once the pile is at rest.
 * Loaded on demand, so charts pay nothing until someone enters the code.
 */
export default function GravityLayer({ dots, width, height, floor, left, right, stroke }: {
  dots: FallingDot[]; width: number; height: number; floor: number; left: number; right: number; stroke: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), n = dots.length;
    cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = Float64Array.from(dots, (d) => d.x), y = Float64Array.from(dots, (d) => d.y), px = x.slice(), py = y.slice();
    const r = Float64Array.from(dots, (d) => d.r + 0.75), free = new Uint8Array(n);
    const lastDelay = Math.max(0, ...dots.map((d) => d.delay));
    let steps = 0, calm = 0;

    const step = () => {
      const t = (steps++ / HZ) * 1000;
      for (let i = 0; i < n; i++) {
        if (!free[i]) { if (dots[i].delay > t) continue; free[i] = 1; }
        const vx = (x[i] - px[i]) * 0.998, vy = (y[i] - py[i]) * 0.998;
        px[i] = x[i]; py[i] = y[i]; x[i] += vx; y[i] += vy + G;
      }
      for (let k = 0; k < ITERATIONS; k++) {
        for (let i = 0; i < n; i++) {
          if (!free[i]) continue;
          for (let j = i + 1; j < n; j++) {
            if (!free[j]) continue;
            const dx = x[j] - x[i], dy = y[j] - y[i], min = r[i] + r[j];
            if (dx > min || dx < -min || dy > min || dy < -min) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            // Marks that share a spot get a fixed nudge apart so the pile is the same every time.
            const d = Math.sqrt(d2) || 0.01, nx = d2 ? dx / d : (i + j) % 2 ? 1 : -1, ny = d2 ? dy / d : 0, push = (min - d) / 2;
            x[i] -= nx * push; y[i] -= ny * push; x[j] += nx * push; y[j] += ny * push;
          }
        }
        for (let i = 0; i < n; i++) {
          if (!free[i]) continue;
          if (x[i] < left + r[i]) x[i] = left + r[i]; else if (x[i] > right - r[i]) x[i] = right - r[i];
          if (y[i] > floor - r[i]) {
            const vy = y[i] - py[i];
            y[i] = floor - r[i];
            // A small bounce on a hard landing, then friction along the axis.
            py[i] = vy > 3 ? y[i] + vy * 0.28 : y[i];
            px[i] = x[i] - (x[i] - px[i]) * 0.86;
          }
        }
      }
      let moved = 0;
      for (let i = 0; i < n; i++) {
        if (!free[i]) continue;
        // Overlapping marks separate without being flung: cap sideways and upward speed.
        const vx = x[i] - px[i], vy = y[i] - py[i];
        if (vx > 2.2) px[i] = x[i] - 2.2; else if (vx < -2.2) px[i] = x[i] + 2.2;
        if (vy < -2.2) py[i] = y[i] + 2.2;
        moved = Math.max(moved, Math.abs(x[i] - px[i]), Math.abs(y[i] - py[i]));
      }
      calm = t > lastDelay && moved < 0.03 ? calm + 1 : 0;
      return calm < HZ / 2 && t < lastDelay + 9000;
    };
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.5; ctx.strokeStyle = stroke;
      for (let i = 0; i < n; i++) {
        ctx.beginPath(); ctx.arc(x[i], y[i], dots[i].r, 0, Math.PI * 2);
        ctx.fillStyle = dots[i].color; ctx.fill(); ctx.stroke();
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No animation: show the settled pile.
      for (let i = 0; i < 4000 && step(); i++);
      draw();
      return;
    }
    let frame = 0, last = performance.now(), owed = 0, running = true;
    const tick = (now: number) => {
      owed += Math.min(now - last, 50) / 1000; last = now;
      while (running && owed >= 1 / HZ) { owed -= 1 / HZ; running = step(); }
      draw();
      if (running) frame = requestAnimationFrame(tick);
    };
    draw();
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dots, width, height, floor, left, right, stroke]);
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", left: 0, top: 0, width, height, pointerEvents: "none", zIndex: 1 }} />;
}
