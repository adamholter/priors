"use client";
import { useEffect, useRef, useState } from "react";
import type * as T from "three";
import type { OrbitControls as Orbit } from "three/examples/jsm/controls/OrbitControls.js";
import { axisIsLog, frontierSurface, valueAt, type Axis, type Point3 } from "@/lib/three-d";

export interface ScenePalette { ink: string; grey: string; hair: string; bg: string }
export type ViewPreset = { ortho: boolean; dir: [number, number, number]; nonce: number };
export type LabelMode = "key" | "all" | "none";

export interface SceneProps {
  points: Point3[];
  axes: [Axis, Axis, Axis];
  zone: [number, number, number];
  titles: [string, string, string];
  palette: ScenePalette;
  colorOf: (p: Point3) => string;
  nameOf: (p: Point3) => string;
  view: ViewPreset;
  labels: LabelMode;
  dropLines: boolean;
  frontier: boolean;
  autoRotate: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onHover: (hit: { id: string; x: number; y: number } | null) => void;
}

const SIZE = 10, HALF = SIZE / 2;
const world = (u: number) => (u - 0.5) * SIZE;
const KEY_LABELS = 16, ALL_LABELS = 90;

interface Box { x: number; y: number; w: number; h: number; owner?: string }
const hit = (a: Box, b: Box, pad = 3) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

/**
 * The 3D scatter: a unit cube whose three edges are the axes, the better end of each at the far corner. The Pareto
 * frontier is drawn as a surface (the staircase of everything the frontier models beat, `frontierSurface`): models on it
 * are full size, models under it are small and faded. The median zone is a light outline. Drawn on demand. Labels are
 * HTML laid out on top of the canvas, so they stay crisp and are placed so that none covers another.
 */
export function Scene3D(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const api = useRef<{ rebuild: () => void; snap: () => void; refresh: () => void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false, cleanup = () => {};
    void (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const el = host.current;
      if (disposed || !el) return;
      let renderer: T.WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const dom = renderer.domElement;
      dom.style.display = "block"; dom.style.touchAction = "none"; dom.style.cursor = "grab";
      el.appendChild(dom);
      const overlay = document.createElement("div");
      overlay.className = "t3d-overlay"; el.appendChild(overlay);

      const scene = new THREE.Scene();
      const content = new THREE.Group(); scene.add(content);
      const persp = new THREE.PerspectiveCamera(38, 1, 0.1, 200), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
      let camera: T.PerspectiveCamera | T.OrthographicCamera = persp, controls: Orbit;
      let pickables: { mesh: T.Mesh; id: string }[] = [];
      let drops: T.Object3D[] = [], surface: T.Object3D[] = [];
      let anchors: { id: string; v: T.Vector3; node: HTMLElement; w: number; h: number }[] = [];
      let statics: { v: T.Vector3; node: HTMLElement; out: number; w: number; h: number; axis?: number; u?: number }[] = [];
      let axisLines: T.Line[] = [];
      const edgeSel = [3, 3, 3];
      let order: string[] = [];
      let hoverId: string | null = null, raf = 0, animating = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const center = new THREE.Vector3();

      const project = (v: T.Vector3) => {
        const p = v.clone().project(camera), w = el.clientWidth, h = el.clientHeight;
        return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, ok: p.z > -1 && p.z < 1 };
      };
      const sizeOf = (n: HTMLElement) => ({ w: n.offsetWidth || 40, h: n.offsetHeight || 16 });

      const place = (n: HTMLElement, x: number, y: number) => { n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; };

      /** Fixed labels (axis ends and titles) first, then point labels in priority order, each at the first spot that is free. */
      const layout = () => {
        const p = latest.current, w = el.clientWidth, h = el.clientHeight;
        const c = project(center), taken: Box[] = [];
        // Each axis runs along the cube edge that sits farthest out on screen, so its numbers never hide behind the points.
        const corners: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        const at = (i: number, t: number, e: [number, number]) => { const v = new THREE.Vector3(); const o = [0, 1, 2].filter((k) => k !== i); v.setComponent(i, t); v.setComponent(o[0], e[0] * HALF); v.setComponent(o[1], e[1] * HALF); return v; };
        for (let i = 0; i < 3; i++) {
          // Far from the middle, but with both ends on screen: an edge that runs off the canvas helps nobody.
          const inside = (v: T.Vector3) => { const q = project(v); const mx = Math.min(70, el.clientWidth * 0.1); return q.x > mx && q.x < el.clientWidth - mx && q.y > 50 && q.y < el.clientHeight - 60; };
          const far = (k: number) => { const m = project(at(i, 0, corners[k])); return Math.hypot(m.x - c.x, m.y - c.y) * (inside(at(i, -HALF, corners[k])) && inside(at(i, HALF, corners[k])) ? 1 : 0.35); };
          let best = edgeSel[i];
          for (let k = 0; k < 4; k++) if (far(k) > far(best) * 1.08) best = k;
          edgeSel[i] = best;
          const pos = axisLines[i]?.geometry.getAttribute("position") as T.BufferAttribute | undefined;
          if (pos) { const a = at(i, -HALF, corners[best]), b = at(i, HALF, corners[best]); pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true; }
        }
        renderer.render(scene, camera);
        for (const s of statics) {
          if (s.axis != null) s.v.copy(at(s.axis, world(s.u ?? 0.5) * (s.u == null ? 0 : 1), corners[edgeSel[s.axis]]));
          const q = project(s.v);
          let dx = q.x - c.x, dy = q.y - c.y, off = s.out;
          if (s.axis != null && s.u != null) {
            // Ends of an axis: push the number past the end along the axis, so two axes that meet at a corner do not stack their numbers.
            const other = project(at(s.axis, world(s.u === 0 ? 1 : 0), corners[edgeSel[s.axis]]));
            dx = q.x - other.x; dy = q.y - other.y;
          }
          const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
          if (s.u != null) off += (Math.abs(dx) * s.w + Math.abs(dy) * s.h) / 2 - 6;
          // Keep every fixed label on the canvas, however the camera is turned.
          const x = Math.max(4, Math.min(el.clientWidth - s.w - 4, q.x + dx * off - s.w / 2)), y = Math.max(4, Math.min(el.clientHeight - s.h - 4, q.y + dy * off - s.h / 2));
          s.node.style.visibility = q.ok ? "visible" : "hidden"; place(s.node, x, y);
          taken.push({ x, y, w: s.w, h: s.h });
        }
        const screen = new Map(anchors.map((a) => [a.id, { ...project(a.v), a }]));
        for (const [id, s] of screen) taken.push({ x: s.x - 8, y: s.y - 8, w: 16, h: 16, owner: id });
        const hot = [p.selected, hoverId].filter((x): x is string => !!x);
        const cap = p.labels === "all" ? ALL_LABELS : p.labels === "key" ? KEY_LABELS : 0;
        let shown = 0;
        for (const id of order) {
          const s = screen.get(id); if (!s) continue;
          const isHot = hot.includes(id);
          const { a } = s;
          if (!s.ok || (!isHot && shown >= cap) || s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) { a.node.style.visibility = "hidden"; continue; }
          const spots: [number, number][] = [[s.x + 11, s.y - a.h / 2], [s.x - 11 - a.w, s.y - a.h / 2], [s.x - a.w / 2, s.y - 12 - a.h], [s.x - a.w / 2, s.y + 12]];
          const free = spots.find(([x, y]) => x > 2 && y > 2 && x + a.w < w - 2 && y + a.h < h - 2 && !taken.some((t) => t.owner !== id && hit({ x, y, w: a.w, h: a.h }, t)));
          const at = free ?? (isHot ? spots[0] : undefined);
          if (!at) { a.node.style.visibility = "hidden"; continue; }
          a.node.style.visibility = "visible"; a.node.classList.toggle("t3d-hot", isHot); place(a.node, at[0], at[1]);
          taken.push({ x: at[0], y: at[1], w: a.w, h: a.h, owner: id }); if (!isHot) shown++;
        }
      };

      const frame = () => {
        raf = 0;
        if (animating > performance.now()) raf = requestAnimationFrame(frame);
        controls.update();
        layout();
        if (latest.current.autoRotate && !raf) raf = requestAnimationFrame(frame);
      };
      const request = () => { if (!raf) raf = requestAnimationFrame(frame); };

      const size = () => {
        const w = el.clientWidth || 600, h = el.clientHeight || 500, a = w / h;
        renderer.setSize(w, h, false); dom.style.width = "100%"; dom.style.height = "100%";
        persp.aspect = a; persp.updateProjectionMatrix();
        const v = 10.2 / Math.min(1, a * 1.05); ortho.left = -v * a; ortho.right = v * a; ortho.top = v; ortho.bottom = -v; ortho.updateProjectionMatrix();
        request();
      };

      const makeControls = () => {
        controls?.dispose();
        controls = new OrbitControls(camera, dom);
        controls.enableDamping = !reduced; controls.dampingFactor = 0.12; controls.minDistance = 6; controls.maxDistance = 45; controls.zoomSpeed = 0.8;
        controls.autoRotateSpeed = 1.4; controls.autoRotate = latest.current.autoRotate;
        controls.addEventListener("change", request);
        controls.addEventListener("start", () => { animating = performance.now() + 60_000; request(); });
        controls.addEventListener("end", () => { animating = performance.now() + 900; request(); });
      };
      const snap = () => {
        const v = latest.current.view;
        camera = v.ortho ? ortho : persp;
        makeControls();
        if (camera === ortho) { ortho.zoom = 1; ortho.updateProjectionMatrix(); }
        const flat = v.dir[0] === 0 && v.dir[2] === 0;
        const aspect = (el.clientWidth || 600) / (el.clientHeight || 500);
        camera.position.set(...v.dir).normalize().multiplyScalar(v.ortho ? 26 : Math.min(44, 28 / Math.min(1, aspect * 1.05)));
        camera.up.set(0, flat ? 0 : 1, flat ? -1 : 0);
        camera.lookAt(0, 0, 0); controls.target.set(0, 0, 0); controls.update();
        animating = performance.now() + 50; request();
      };

      const clear = () => {
        for (const o of [...content.children]) {
          content.remove(o);
          o.traverse((n) => {
            const m = n as T.Mesh & { material?: T.Material | T.Material[]; geometry?: T.BufferGeometry };
            m.geometry?.dispose();
            for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) mat.dispose();
          });
        }
        overlay.replaceChildren();
        pickables = []; drops = []; surface = []; anchors = []; statics = []; axisLines = []; order = [];
      };

      const line = (a: T.Vector3, b: T.Vector3, color: string, opacity = 1) =>
        new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      const tag = (html: string, cls: string) => { const n = document.createElement("div"); n.className = `t3d-label ${cls}`; n.innerHTML = html; overlay.appendChild(n); return n; };
      const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

      const rebuild = () => {
        const p = latest.current;
        clear();
        const { ink, grey, bg } = p.palette;
        const good = getComputedStyle(document.documentElement).getPropertyValue("--good").trim() || ink;
        // Only the three axes are drawn, on whichever cube edges face outward, so the points are what you see.
        axisLines = [0, 1, 2].map(() => line(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), grey, 0.9));
        axisLines.forEach((l) => content.add(l));
        for (let i = 0; i < 3; i++) {
          const axis = p.axes[i], log = axisIsLog(axis);
          for (const u of [0, 1]) {
            const n = tag(esc(axis.meta.format(valueAt(axis, u, log))), "t3d-tick"); statics.push({ v: new THREE.Vector3(), node: n, out: 14, axis: i, u, ...sizeOf(n) });
          }
          const n = tag(`<b>${esc(p.titles[i])}</b><i>${axis.meta.better === "lower" ? "lower" : "higher"} is better →</i>`, "t3d-title"); statics.push({ v: new THREE.Vector3(), node: n, out: 44, axis: i, ...sizeOf(n) });
        }
        // The median zone (better than the median model on all three axes) as a light outline: the frontier surface is the figure.
        const lo = p.zone.map((u) => world(u)), span = lo.map((l) => HALF - l);
        if (span.every((s) => s > 0.05)) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(span[0], span[1], span[2])), new THREE.LineDashedMaterial({ color: grey, transparent: true, opacity: 0.45, dashSize: 0.25, gapSize: 0.18 }));
          edges.position.set(lo[0] + span[0] / 2, lo[1] + span[1] / 2, lo[2] + span[2] / 2); edges.computeLineDistances(); content.add(edges);
        }
        // The frontier surface: walls facing each axis at their own strength, so the steps read as steps, and the outline of each step.
        const { faces, edges: outline } = frontierSurface(p.points);
        const wv = (c: [number, number, number]) => [world(c[0]), world(c[1]), world(c[2])];
        for (const axis of [0, 1, 2] as const) {
          const quads = faces.filter((f) => f.axis === axis);
          if (!quads.length) continue;
          const pos = new Float32Array(quads.length * 18);
          quads.forEach((f, q) => { const [a, b, c, d] = f.corners.map(wv); pos.set([...a, ...b, ...c, ...a, ...c, ...d], q * 18); });
          const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const wall = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: good, transparent: true, opacity: axis === 1 ? 0.15 : axis === 0 ? 0.06 : 0.045, depthWrite: false, side: THREE.DoubleSide }));
          wall.renderOrder = -1; content.add(wall); surface.push(wall);
        }
        if (outline.length) {
          const pos = new Float32Array(outline.length * 6);
          outline.forEach(([a, b], q) => pos.set([...wv(a), ...wv(b)], q * 6));
          const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: good, transparent: true, opacity: 0.42 }));
          content.add(lines); surface.push(lines);
        }
        const corner = tag("Best corner", "t3d-corner"); corner.style.color = good;
        statics.push({ v: new THREE.Vector3(HALF, HALF, HALF), node: corner, out: 22, ...sizeOf(corner) });

        const byScore = [...p.points].sort((a, b) => b.r.score - a.r.score);
        const key = new Set([...p.points.filter((q) => q.frontier).map((q) => q.id), ...byScore.slice(0, 8).map((q) => q.id)]);
        order = [...byScore].sort((a, b) => Number(key.has(b.id)) - Number(key.has(a.id)) || Number(b.frontier) - Number(a.frontier) || b.r.score - a.r.score).map((q) => q.id);
        for (const q of p.points) {
          const color = p.colorOf(q), pos = new THREE.Vector3(world(q.pos[0]), world(q.pos[1]), world(q.pos[2]));
          // On the frontier: full size. Under it: smaller and faded, so the models that matter stand out.
          const r = q.frontier ? 0.22 : 0.14, fade = q.frontier ? 1 : 0.42;
          const halo = new THREE.Mesh(new THREE.SphereGeometry(r + 0.07, 18, 12), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide, transparent: fade < 1, opacity: fade }));
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), new THREE.MeshBasicMaterial({ color, transparent: fade < 1, opacity: fade }));
          halo.position.copy(pos); mesh.position.copy(pos); content.add(halo, mesh); pickables.push({ mesh, id: q.id });
          const drop = line(pos, new THREE.Vector3(pos.x, -HALF, pos.z), grey, q.frontier ? 0.22 : 0.1);
          const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: grey, transparent: true, opacity: 0.3 }));
          dot.rotation.x = -Math.PI / 2; dot.position.set(pos.x, -HALF + 0.01, pos.z); drops.push(drop, dot); content.add(drop, dot);
          const n = tag(esc(p.nameOf(q)), q.frontier ? "t3d-name" : "t3d-name t3d-under"); n.style.visibility = "hidden";
          anchors.push({ id: q.id, v: pos, node: n, ...sizeOf(n) });
        }
        refresh();
      };

      const refresh = () => {
        const p = latest.current;
        for (const d of drops) d.visible = p.dropLines;
        for (const s of surface) s.visible = p.frontier;
        for (const { mesh, id } of pickables) mesh.scale.setScalar(id === p.selected ? 1.8 : id === hoverId ? 1.4 : 1);
        controls.autoRotate = p.autoRotate && !p.selected;
        request();
      };

      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      const pick = (e: PointerEvent) => {
        const r = dom.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const h = ray.intersectObjects(pickables.map((x) => x.mesh), false)[0];
        return h ? pickables.find((x) => x.mesh === h.object)!.id : null;
      };
      let down: { x: number; y: number } | null = null;
      const onMove = (e: PointerEvent) => {
        if (e.buttons) { if (hoverId) { hoverId = null; latest.current.onHover(null); refresh(); } return; }
        const id = pick(e);
        if (id !== hoverId) { hoverId = id; refresh(); }
        latest.current.onHover(id ? { id, x: e.clientX, y: e.clientY } : null);
        dom.style.cursor = id ? "pointer" : "grab";
      };
      const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
      const onUp = (e: PointerEvent) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
        const id = pick(e); latest.current.onSelect(id && id !== latest.current.selected ? id : null);
      };
      const onLeave = () => { hoverId = null; latest.current.onHover(null); refresh(); };
      dom.addEventListener("pointermove", onMove); dom.addEventListener("pointerdown", onDown); dom.addEventListener("pointerup", onUp); dom.addEventListener("pointerleave", onLeave);

      const ro = new ResizeObserver(size); ro.observe(el);
      makeControls(); size(); snap(); rebuild();
      // Fonts arrive after the first layout: measure the labels again once they have.
      void document.fonts?.ready.then(() => { for (const a of anchors) Object.assign(a, sizeOf(a.node)); for (const s of statics) Object.assign(s, sizeOf(s.node)); request(); });
      api.current = { rebuild, snap, refresh };
      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); clear();
        dom.removeEventListener("pointermove", onMove); dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointerleave", onLeave);
        renderer.dispose(); dom.remove(); overlay.remove(); api.current = null;
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => { api.current?.rebuild(); }, [props.points, props.axes, props.zone, props.titles, props.palette, props.colorOf, props.nameOf]);
  useEffect(() => { api.current?.refresh(); }, [props.labels, props.dropLines, props.frontier, props.autoRotate, props.selected]);
  useEffect(() => { api.current?.snap(); }, [props.view]);
  return failed ? <p role="alert" className="p-6 text-[13.5px] text-ink-2">This browser could not start WebGL, which the 3D chart needs.</p> : <div ref={host} className="t3d-host" />;
}
