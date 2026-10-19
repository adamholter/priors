"use client";
import { useEffect, useRef, useState } from "react";
import type * as T from "three";
import type { OrbitControls as Orbit } from "three/examples/jsm/controls/OrbitControls.js";
import { axisIsLog, valueAt, type Axis, type Point3 } from "@/lib/three-d";

export interface ScenePalette { ink: string; grey: string; hair: string }
export type ViewPreset = { ortho: boolean; dir: [number, number, number]; nonce: number };
export type LabelMode = "key" | "all" | "none";

export interface SceneProps {
  points: Point3[];
  axes: [Axis, Axis, Axis];
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

/** A line of text as a sprite, so labels stay readable from any side. */
function textSprite(THREE: typeof T, text: string, color: string, px = 30, weight = 500): T.Sprite {
  const dpr = 2, pad = 6, c = document.createElement("canvas"), g = c.getContext("2d")!;
  const font = `${weight} ${px * dpr}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * dpr * 2, h = px * dpr + pad * dpr * 2;
  c.width = w; c.height = h;
  g.font = font; g.fillStyle = color; g.textBaseline = "middle"; g.textAlign = "center";
  g.fillText(text, w / 2, h / 2 + dpr);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  const k = 0.0092; sprite.scale.set((w / dpr) * k, (h / dpr) * k, 1); sprite.renderOrder = 10;
  return sprite;
}

/** The 3D scatter: a unit cube whose three edges are the axes, the better end of each at the far corner. Drawn on demand. */
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
      el.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";
      const scene = new THREE.Scene();
      const content = new THREE.Group(); scene.add(content);
      const persp = new THREE.PerspectiveCamera(38, 1, 0.1, 200), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
      let camera: T.PerspectiveCamera | T.OrthographicCamera = persp, controls: Orbit;
      let pickables: { mesh: T.Mesh; id: string }[] = [];
      let sprites: { sprite: T.Sprite; id: string; key: boolean; kind: "label" }[] = [];
      let drops: T.Object3D[] = [], frontierShells: T.Object3D[] = [];
      let hoverId: string | null = null, raf = 0, animating = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const frame = () => {
        raf = 0;
        const now = performance.now();
        if (animating > now) { raf = requestAnimationFrame(frame); }
        controls.update();
        renderer.render(scene, camera);
        if (latest.current.autoRotate && !raf) raf = requestAnimationFrame(frame);
      };
      const request = () => { if (!raf) raf = requestAnimationFrame(frame); };

      const size = () => {
        const w = el.clientWidth || 600, h = el.clientHeight || 500, a = w / h;
        renderer.setSize(w, h, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
        persp.aspect = a; persp.updateProjectionMatrix();
        const v = 9; ortho.left = -v * a; ortho.right = v * a; ortho.top = v; ortho.bottom = -v; ortho.updateProjectionMatrix();
        request();
      };

      const makeControls = () => {
        controls?.dispose();
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = !reduced; controls.dampingFactor = 0.12; controls.minDistance = 6; controls.maxDistance = 45; controls.zoomSpeed = 0.8;
        controls.autoRotateSpeed = 1.4; controls.autoRotate = latest.current.autoRotate;
        controls.addEventListener("change", request);
        controls.addEventListener("start", () => { animating = performance.now() + 60_000; request(); });
        controls.addEventListener("end", () => { animating = performance.now() + 900; request(); });
      };
      const place = (dir: [number, number, number], dist: number) => {
        const d = new THREE.Vector3(...dir).normalize().multiplyScalar(dist);
        camera.position.copy(d); camera.up.set(0, dir[0] === 0 && dir[2] === 0 ? 0 : 1, dir[0] === 0 && dir[2] === 0 ? -1 : 0);
        if (dir[0] === 0 && dir[2] === 0) camera.up.set(0, 0, -1); else camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0); controls.target.set(0, 0, 0); controls.update();
      };
      const snap = () => {
        const v = latest.current.view;
        camera = v.ortho ? ortho : persp;
        makeControls();
        if (camera === ortho) { ortho.zoom = 1; ortho.updateProjectionMatrix(); }
        place(v.dir, 26);
        animating = performance.now() + 50; request();
      };

      const clear = () => {
        for (const o of [...content.children]) {
          content.remove(o);
          o.traverse((n) => {
            const m = n as T.Mesh & { material?: T.Material | T.Material[]; geometry?: T.BufferGeometry };
            m.geometry?.dispose();
            for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) { (mat as T.SpriteMaterial).map?.dispose(); mat.dispose(); }
          });
        }
        pickables = []; sprites = []; drops = []; frontierShells = [];
      };

      const line = (a: T.Vector3Like, b: T.Vector3Like, color: string, opacity = 1, dashed = false) => {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
        const mat = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.18, gapSize: 0.14 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
        const l = new THREE.Line(geo, mat); if (dashed) l.computeLineDistances(); return l;
      };

      const rebuild = () => {
        const p = latest.current;
        clear();
        const { ink, grey, hair } = p.palette;
        // Walls and floor on the far sides, so points never sit behind a panel.
        const grid = (rot: [number, number, number], pos: [number, number, number]) => {
          const g = new THREE.GridHelper(SIZE, 10, hair, hair); g.rotation.set(...rot); g.position.set(...pos);
          (g.material as T.LineBasicMaterial).transparent = true; (g.material as T.LineBasicMaterial).opacity = 0.55; content.add(g);
        };
        grid([0, 0, 0], [0, -HALF, 0]); grid([Math.PI / 2, 0, 0], [0, 0, -HALF]); grid([0, 0, Math.PI / 2], [-HALF, 0, 0]);
        // The three axes meet at the worst corner.
        const o = { x: -HALF, y: -HALF, z: -HALF };
        content.add(line(o, { x: HALF, y: -HALF, z: -HALF }, ink, 0.9), line(o, { x: -HALF, y: HALF, z: -HALF }, ink, 0.9), line(o, { x: -HALF, y: -HALF, z: HALF }, ink, 0.9));
        const ends: [T.Vector3Like, number][] = [[{ x: HALF, y: -HALF, z: -HALF }, 0], [{ x: -HALF, y: HALF, z: -HALF }, 1], [{ x: -HALF, y: -HALF, z: HALF }, 2]];
        for (const [end, i] of ends) {
          const axis = p.axes[i], log = axisIsLog(axis);
          for (const u of [0, 0.25, 0.5, 0.75, 1]) {
            const at = i === 0 ? { x: world(u), y: -HALF - 0.55, z: -HALF - 0.55 } : i === 1 ? { x: -HALF - 0.7, y: world(u), z: -HALF - 0.1 } : { x: -HALF - 0.55, y: -HALF - 0.55, z: world(u) };
            const s = textSprite(THREE, axis.meta.format(valueAt(axis, u, log)), grey, 22, 400); s.position.set(at.x, at.y, at.z); content.add(s);
          }
          const title = textSprite(THREE, `${p.titles[i]}  ·  ${axis.meta.better === "lower" ? "lower" : "higher"} is better →`, ink, 26, 600);
          const tp = i === 0 ? { x: 0, y: -HALF - 1.7, z: -HALF - 0.9 } : i === 1 ? { x: -HALF - 1.2, y: HALF + 0.7, z: -HALF } : { x: -HALF - 1.4, y: -HALF - 1.4, z: HALF * 0.9 };
          title.position.set(tp.x, tp.y, tp.z); content.add(title);
          void end;
        }
        // The best corner.
        const best = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), new THREE.MeshBasicMaterial({ color: ink, wireframe: true }));
        best.position.set(HALF, HALF, HALF); content.add(best);
        const bl = textSprite(THREE, "Best corner", ink, 26, 600); bl.position.set(HALF, HALF + 0.9, HALF); content.add(bl);

        const nearest = p.points.reduce<Point3 | null>((m, q) => (!m || q.gap < m.gap ? q : m), null);
        const ranked = [...p.points].sort((a, b) => b.r.score - a.r.score);
        const keyIds = new Set([...ranked.slice(0, 8).map((q) => q.id), ...p.points.filter((q) => q.frontier).map((q) => q.id)]);
        for (const q of p.points) {
          const color = p.colorOf(q), pos = new THREE.Vector3(world(q.pos[0]), world(q.pos[1]), world(q.pos[2]));
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshBasicMaterial({ color }));
          mesh.position.copy(pos); content.add(mesh); pickables.push({ mesh, id: q.id });
          if (q.frontier) {
            const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 }));
            shell.position.copy(pos); content.add(shell); frontierShells.push(shell);
          }
          const drop = line(pos, { x: pos.x, y: -HALF, z: pos.z }, grey, 0.35);
          const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: grey, transparent: true, opacity: 0.45 }));
          dot.rotation.x = -Math.PI / 2; dot.position.set(pos.x, -HALF + 0.01, pos.z);
          drops.push(drop, dot); content.add(drop, dot);
          const label = textSprite(THREE, p.nameOf(q), ink, 24, 500); label.position.set(pos.x, pos.y + 0.55, pos.z);
          sprites.push({ sprite: label, id: q.id, key: keyIds.has(q.id), kind: "label" }); content.add(label);
        }
        if (nearest) {
          const l = line({ x: world(nearest.pos[0]), y: world(nearest.pos[1]), z: world(nearest.pos[2]) }, { x: HALF, y: HALF, z: HALF }, ink, 0.7, true); content.add(l);
        }
        refresh();
      };

      const refresh = () => {
        const p = latest.current, hot = p.selected ?? hoverId;
        for (const s of sprites) s.sprite.visible = p.labels === "all" || (p.labels === "key" && s.key) || s.id === hot;
        for (const d of drops) d.visible = p.dropLines;
        for (const s of frontierShells) s.visible = p.frontier;
        for (const { mesh, id } of pickables) mesh.scale.setScalar(id === p.selected ? 1.9 : id === hoverId ? 1.5 : 1);
        controls.autoRotate = p.autoRotate && !p.selected;
        request();
      };

      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      const pick = (e: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(pickables.map((x) => x.mesh), false)[0];
        return hit ? pickables.find((x) => x.mesh === hit.object)!.id : null;
      };
      let down: { x: number; y: number } | null = null;
      const onMove = (e: PointerEvent) => {
        if (e.buttons) { if (hoverId) { hoverId = null; latest.current.onHover(null); refresh(); } return; }
        const id = pick(e);
        if (id !== hoverId) { hoverId = id; refresh(); }
        latest.current.onHover(id ? { id, x: e.clientX, y: e.clientY } : null);
        renderer.domElement.style.cursor = id ? "pointer" : "grab";
      };
      const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
      const onUp = (e: PointerEvent) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
        const id = pick(e); latest.current.onSelect(id && id !== latest.current.selected ? id : null);
      };
      const onLeave = () => { hoverId = null; latest.current.onHover(null); refresh(); };
      const dom = renderer.domElement;
      dom.addEventListener("pointermove", onMove); dom.addEventListener("pointerdown", onDown); dom.addEventListener("pointerup", onUp); dom.addEventListener("pointerleave", onLeave);

      const ro = new ResizeObserver(size); ro.observe(el);
      makeControls(); size(); snap(); rebuild();
      api.current = { rebuild, snap, refresh };
      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); clear();
        dom.removeEventListener("pointermove", onMove); dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointerleave", onLeave);
        renderer.dispose(); dom.remove(); api.current = null;
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => { api.current?.rebuild(); }, [props.points, props.axes, props.titles, props.palette, props.colorOf, props.nameOf]);
  useEffect(() => { api.current?.refresh(); }, [props.labels, props.dropLines, props.frontier, props.autoRotate, props.selected]);
  useEffect(() => { api.current?.snap(); }, [props.view]);
  return failed ? <p role="alert" className="p-6 text-[13.5px] text-ink-2">This browser could not start WebGL, which the 3D chart needs.</p> : <div ref={host} className="w-full h-full" />;
}
