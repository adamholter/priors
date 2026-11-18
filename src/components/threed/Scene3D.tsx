"use client";
import { useEffect, useRef, useState } from "react";
import type * as T from "three";
import type { OrbitControls as Orbit } from "three/examples/jsm/controls/OrbitControls.js";
import { axisTicks, frontierSurface, type Axis, type Point3 } from "@/lib/three-d";

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
const KEY_LABELS = 16, ALL_LABELS = 90, FOV = 50, INTRO_MS = 1500, INTRO_TURN = 0.55;
const ease = (t: number) => 1 - (1 - t) ** 3;

interface Box { x: number; y: number; w: number; h: number; owner?: string }
const hit = (a: Box, b: Box, pad = 3) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

/**
 * The 3D scatter: a cube with the better end of every axis at the far corner, built to be read rather than admired. What the research on
 * 3D scatterplots supports is used here: a real perspective, grid walls behind the data that follow the camera, each point projected onto the
 * floor and both back walls, drop lines, solid points so nearer ones hide farther ones, and motion when the chart opens. The Pareto frontier
 * is one translucent layer (`frontierSurface`, depth-tested so only its nearest face shows). Hovering or picking a model draws its three paths
 * to the walls and marks its values on the axes. Drawn on demand. Labels are HTML on top of the canvas, placed so none covers another.
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
      // Soft light so the points read as round objects; everything else is flat.
      const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(4, 10, 6);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 2.35), sun);
      const persp = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
      let camera: T.PerspectiveCamera | T.OrthographicCamera = persp, controls: Orbit;
      let pickables: { mesh: T.Mesh; id: string }[] = [];
      let drops: T.Object3D[] = [], surface: T.Object3D[] = [];
      let anchors: { id: string; v: T.Vector3; node: HTMLElement; w: number; h: number }[] = [];
      let statics: { v: T.Vector3; node: HTMLElement; out: number; w: number; h: number; axis?: number; u?: number; tick?: boolean; chip?: boolean }[] = [];
      let axisLines: T.Line[] = [], arrows: T.Mesh[] = [], walls: { axis: 0 | 2; side: -1 | 1; group: T.Group }[] = [];
      let paths: T.LineSegments | null = null, pathDots: T.Mesh[] = [];
      let intro: { from: number; end: T.Vector3 } | null = null, introPlayed = false;
      let order: string[] = [], keyIds = new Set<string>();
      let hoverId: string | null = null, raf = 0, animating = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const center = new THREE.Vector3();

      const project = (v: T.Vector3) => {
        const p = v.clone().project(camera), w = el.clientWidth, h = el.clientHeight;
        return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, ok: p.z > -1 && p.z < 1 };
      };
      const sizeOf = (n: HTMLElement) => ({ w: n.offsetWidth || 40, h: n.offsetHeight || 16 });

      const place = (n: HTMLElement, x: number, y: number) => { n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; };

      /** Walls and axes follow the camera, then fixed labels go down first and point labels take the free spots, in priority order. */
      const layout = () => {
        const p = latest.current, w = el.clientWidth, h = el.clientHeight;
        const c = project(center), taken: Box[] = [], cam = camera.position;
        const back = [cam.x > 0 ? -HALF : HALF, -HALF, cam.z > 0 ? -HALF : HALF];
        for (const wall of walls) wall.group.visible = cam.getComponent(wall.axis) * wall.side < 0;
        // The two flat axes run along the floor's near edges and the vertical one up the cube's right-hand side, so numbers sit outside the data.
        const at = (i: number, t: number, e: [number, number]) => { const v = new THREE.Vector3(); const o = [0, 1, 2].filter((k) => k !== i); v.setComponent(i, t); v.setComponent(o[0], e[0] * HALF); v.setComponent(o[1], e[1] * HALF); return v; };
        const sx = cam.x >= 0 ? 1 : -1, sz = cam.z >= 0 ? 1 : -1, sides: [number, number][] = [[sx, -sz], [-sx, sz]];
        const edges: [number, number][] = [[-1, sz], project(at(1, 0, sides[0])).x >= project(at(1, 0, sides[1])).x ? sides[0] : sides[1], [sx, -1]];
        for (let i = 0; i < 3; i++) {
          const pos = axisLines[i]?.geometry.getAttribute("position") as T.BufferAttribute | undefined, a = at(i, -HALF, edges[i]), b = at(i, HALF, edges[i]);
          if (pos) { pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true; }
          arrows[i]?.position.copy(b);
        }
        const hotId = p.selected ?? hoverId, hotAnchor = hotId ? anchors.find((a) => a.id === hotId) : undefined;
        if (paths) {
          paths.visible = !!hotAnchor;
          pathDots.forEach((d) => { d.visible = !!hotAnchor; });
          if (hotAnchor) {
            const v = hotAnchor.v, ends = [[back[0], v.y, v.z], [v.x, back[1], v.z], [v.x, v.y, back[2]]], pos = paths.geometry.getAttribute("position") as T.BufferAttribute;
            ends.forEach((e, i) => { pos.setXYZ(i * 2, v.x, v.y, v.z); pos.setXYZ(i * 2 + 1, e[0], e[1], e[2]); pathDots[i].position.set(e[0], e[1], e[2]); });
            pos.needsUpdate = true;
          }
        }
        renderer.render(scene, camera);
        for (const s of statics) {
          if (s.chip && !hotAnchor) { s.node.style.visibility = "hidden"; continue; }
          if (s.axis != null) s.v.copy(at(s.axis, s.u == null ? 0 : world(s.u), edges[s.axis]));
          const q = project(s.v);
          let dx = q.x - c.x, dy = q.y - c.y, off = s.out;
          const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
          if (s.axis != null) off += (Math.abs(dx) * s.w + Math.abs(dy) * s.h) / 2;
          // Keep every fixed label on the canvas, however the camera is turned.
          const spotAt = (o: number) => ({ x: Math.max(4, Math.min(w - s.w - 4, q.x + dx * o - s.w / 2)), y: Math.max(4, Math.min(h - s.h - 4, q.y + dy * o - s.h / 2)), w: s.w, h: s.h });
          // An axis title steps outward from a value chip rather than sitting under it.
          let box = spotAt(off); if (s.axis != null && s.u == null && taken.some((t) => hit(box, t, 2))) box = spotAt(off + 26);
          const { x, y } = box;
          if (!q.ok || (s.tick && taken.some((t) => hit(box, t, 2)))) { s.node.style.visibility = "hidden"; continue; }
          s.node.style.visibility = "visible"; place(s.node, x, y);
          taken.push(box);
        }
        const screen = new Map(anchors.map((a) => [a.id, { ...project(a.v), a }]));
        for (const [id, s] of screen) taken.push({ x: s.x - 8, y: s.y - 8, w: 16, h: 16, owner: id });
        const hot = [p.selected, hoverId].filter((x): x is string => !!x);
        const cap = p.labels === "all" ? ALL_LABELS : p.labels === "key" ? KEY_LABELS : 0;
        let shown = 0;
        for (const id of order) {
          const s = screen.get(id); if (!s) continue;
          const isHot = hot.includes(id), { a } = s;
          if (!s.ok || (!isHot && (shown >= cap || (p.labels === "key" && !keyIds.has(id)))) || s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) { a.node.style.visibility = "hidden"; continue; }
          const spots: [number, number][] = [[s.x + 11, s.y - a.h / 2], [s.x - 11 - a.w, s.y - a.h / 2], [s.x - a.w / 2, s.y - 12 - a.h], [s.x - a.w / 2, s.y + 12]];
          const free = spots.find(([x, y]) => x > 2 && y > 2 && x + a.w < w - 2 && y + a.h < h - 2 && !taken.some((t) => t.owner !== id && hit({ x, y, w: a.w, h: a.h }, t)));
          const spot = free ?? (isHot ? spots[0] : undefined);
          if (!spot) { a.node.style.visibility = "hidden"; continue; }
          a.node.style.visibility = "visible"; a.node.classList.toggle("t3d-hot", isHot); place(a.node, spot[0], spot[1]);
          taken.push({ x: spot[0], y: spot[1], w: a.w, h: a.h, owner: id }); if (!isHot) shown++;
        }
      };

      const frame = () => {
        raf = 0;
        if (animating > performance.now()) raf = requestAnimationFrame(frame);
        // The chart turns into place when it opens: motion is the depth cue people read best.
        if (intro) {
          const k = Math.min(1, (performance.now() - intro.from) / INTRO_MS);
          camera.position.copy(intro.end).applyAxisAngle(new THREE.Vector3(0, 1, 0), (1 - ease(k)) * INTRO_TURN);
          if (k >= 1) intro = null;
        }
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
        controls.enableDamping = !reduced; controls.dampingFactor = 0.12; controls.minDistance = 6; controls.maxDistance = 45; controls.zoomSpeed = 0.8; controls.maxPolarAngle = Math.PI / 2;
        controls.autoRotateSpeed = 0.8; controls.autoRotate = latest.current.autoRotate;
        controls.addEventListener("change", request);
        controls.addEventListener("start", () => { intro = null; animating = performance.now() + 60_000; request(); });
        controls.addEventListener("end", () => { animating = performance.now() + 900; request(); });
      };
      const snap = () => {
        const v = latest.current.view;
        camera = v.ortho ? ortho : persp;
        makeControls();
        if (camera === ortho) { ortho.zoom = 1; ortho.updateProjectionMatrix(); }
        const flat = v.dir[0] === 0 && v.dir[2] === 0;
        const aspect = (el.clientWidth || 600) / (el.clientHeight || 500);
        camera.position.set(...v.dir).normalize().multiplyScalar(v.ortho ? 26 : Math.min(44, 22 / Math.min(1, aspect * 1.05)));
        camera.up.set(0, flat ? 0 : 1, flat ? -1 : 0);
        const aim = v.ortho ? 0 : -0.5; camera.position.y += aim; camera.lookAt(0, aim, 0); controls.target.set(0, aim, 0); controls.update();
        animating = performance.now() + 50;
        if (!v.ortho && !introPlayed && !reduced) { introPlayed = true; intro = { from: performance.now(), end: camera.position.clone() }; animating = performance.now() + INTRO_MS + 100; }
        request();
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
        pickables = []; drops = []; surface = []; anchors = []; statics = []; axisLines = []; arrows = []; walls = []; paths = null; pathDots = []; order = []; keyIds = new Set();
      };

      const line = (a: T.Vector3, b: T.Vector3, color: string, opacity = 1) =>
        new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      const tag = (html: string, cls: string) => { const n = document.createElement("div"); n.className = `t3d-label ${cls}`; n.innerHTML = html; overlay.appendChild(n); return n; };
      const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

      /** A point on the cube from the axis values given, for the walls and their grids. */
      const onCube = (vals: Partial<Record<0 | 1 | 2, number>>) => new THREE.Vector3(vals[0] ?? 0, vals[1] ?? 0, vals[2] ?? 0);
      const segments = (pts: T.Vector3[], color: string, opacity: number, order = -4) => {
        const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
        l.renderOrder = order; return l;
      };

      const rebuild = () => {
        const p = latest.current;
        clear();
        const { ink, grey, bg } = p.palette, paper = new THREE.Color(bg);
        const good = getComputedStyle(document.documentElement).getPropertyValue("--good").trim() || ink;
        const ticks = p.axes.map((a) => axisTicks(a, 5));
        const placed = p.points.map((q) => ({ q, color: p.colorOf(q), pos: new THREE.Vector3(world(q.pos[0]), world(q.pos[1]), world(q.pos[2])) }));

        // A wall: a faint panel, its grid at the round values of the two axes in its plane, and every model's position projected onto it.
        const wall = (axis: 0 | 1 | 2, at: number) => {
          const group = new THREE.Group(), [a, b] = ([0, 1, 2] as const).filter((x) => x !== axis) as [0 | 1 | 2, 0 | 1 | 2], grid: T.Vector3[] = [];
          const panelShape = new THREE.PlaneGeometry(SIZE, SIZE); if (axis === 0) panelShape.rotateY(Math.PI / 2); if (axis === 1) panelShape.rotateX(-Math.PI / 2);
          const panel = new THREE.Mesh(panelShape, new THREE.MeshBasicMaterial({ color: grey, transparent: true, opacity: axis === 1 ? 0.09 : 0.05, depthWrite: false, side: THREE.DoubleSide }));
          panel.position.setComponent(axis, at); panel.renderOrder = -6; group.add(panel);
          for (const [run, across] of [[a, b], [b, a]] as const) for (const u of [...ticks[run].map((t) => world(t.u)), -HALF, HALF]) grid.push(onCube({ [axis]: at, [run]: u, [across]: -HALF }), onCube({ [axis]: at, [run]: u, [across]: HALF }));
          group.add(segments(grid, grey, 0.3, -5));
          const dot = new THREE.CircleGeometry(1, 16); if (axis === 0) dot.rotateY(Math.PI / 2); if (axis === 1) dot.rotateX(-Math.PI / 2);
          const shadows = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), placed.length), m = new THREE.Matrix4();
          placed.forEach(({ q, color, pos }, i) => {
            const v = pos.clone(), r = q.frontier ? 0.13 : 0.075; v.setComponent(axis, at - Math.sign(at) * 0.02);
            shadows.setMatrixAt(i, m.makeScale(r, r, r).setPosition(v));
            shadows.setColorAt(i, new THREE.Color(q.frontier ? color : grey).lerp(paper, q.frontier ? 0.35 : 0.55));
          });
          shadows.renderOrder = -4; group.add(shadows); drops.push(shadows); content.add(group);
          return group;
        };
        wall(1, -HALF);
        for (const axis of [0, 2] as const) for (const side of [-1, 1] as const) walls.push({ axis, side, group: wall(axis, side * HALF) });

        // The three axes, each with an arrowhead at its better end.
        axisLines = [0, 1, 2].map(() => line(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), ink, 0.65));
        axisLines.forEach((l) => content.add(l));
        arrows = ([0, 1, 2] as const).map((i) => {
          const m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 14), new THREE.MeshBasicMaterial({ color: ink }));
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().setComponent(i, 1)); content.add(m); return m;
        });
        const titles: typeof statics = [], chips: typeof statics = [], marks: typeof statics = [];
        for (let i = 0; i < 3; i++) {
          const axis = p.axes[i], n = tag(`<b>${esc(p.titles[i])}</b><i>${axis.meta.better === "lower" ? "lower" : "higher"} is better</i>`, "t3d-title");
          titles.push({ v: new THREE.Vector3(), node: n, out: 34, axis: i, ...sizeOf(n) });
          const chip = tag("", "t3d-chip"); chips.push({ v: new THREE.Vector3(), node: chip, out: 8, axis: i, u: 0.5, chip: true, ...sizeOf(chip) });
          for (const t of ticks[i]) { const m = tag(esc(t.label), "t3d-tick"); marks.push({ v: new THREE.Vector3(), node: m, out: 7, axis: i, u: t.u, tick: true, ...sizeOf(m) }); }
        }

        // The frontier as one layer: a depth pass first, so the colour pass and the outline show only its nearest face and the steps stay readable.
        const { faces, edges: outline } = frontierSurface(p.points);
        const wv = (c: [number, number, number]) => [world(c[0]), world(c[1]), world(c[2])];
        for (const axis of [0, 1, 2] as const) {
          const quads = faces.filter((f) => f.axis === axis);
          if (!quads.length) continue;
          const pos = new Float32Array(quads.length * 18);
          quads.forEach((f, q) => { const [a, b, c, d] = f.corners.map(wv); pos.set([...a, ...b, ...c, ...a, ...c, ...d], q * 18); });
          const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const offset = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.DoubleSide };
          const depth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...offset, transparent: true, colorWrite: false, depthWrite: true }));
          const skin = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ ...offset, color: good, transparent: true, opacity: axis === 1 ? 0.2 : axis === 0 ? 0.07 : 0.11, depthWrite: false, depthFunc: THREE.LessEqualDepth }));
          depth.renderOrder = 2; skin.renderOrder = 3; content.add(depth, skin); surface.push(depth, skin);
        }
        if (outline.length) {
          const lines = segments(outline.flatMap(([a, b]) => [new THREE.Vector3(...(wv(a) as [number, number, number])), new THREE.Vector3(...(wv(b) as [number, number, number]))]), good, 0.5, 4);
          content.add(lines); surface.push(lines);
        }
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: good })); star.position.set(HALF, HALF, HALF); content.add(star);
        const corner = tag("Best corner", "t3d-corner"); corner.style.color = good;
        const cornerMark = { v: new THREE.Vector3(HALF, HALF, HALF), node: corner, out: 20, ...sizeOf(corner) };
        statics = [...chips, ...titles, cornerMark, ...marks];

        const byScore = [...p.points].sort((a, b) => b.r.score - a.r.score);
        keyIds = new Set([...p.points.filter((q) => q.frontier).map((q) => q.id), ...byScore.slice(0, 3).map((q) => q.id)]);
        order = [...byScore].sort((a, b) => Number(keyIds.has(b.id)) - Number(keyIds.has(a.id)) || Number(b.frontier) - Number(a.frontier) || b.r.score - a.r.score).map((q) => q.id);
        const floorLines: T.Vector3[] = [], sphere = new THREE.SphereGeometry(1, 24, 16);
        for (const { q, color, pos } of placed) {
          // Solid, so a nearer point hides a farther one. Frontier models are large and ringed; the rest are small and muted.
          const r = q.frontier ? 0.25 : 0.14, tint = q.frontier ? new THREE.Color(color) : new THREE.Color(color).lerp(paper, 0.5);
          const mesh = new THREE.Mesh(sphere.clone(), new THREE.MeshLambertMaterial({ color: tint })); mesh.scale.setScalar(r); mesh.position.copy(pos); mesh.userData.r = r; content.add(mesh); pickables.push({ mesh, id: q.id });
          if (q.frontier) { const halo = new THREE.Mesh(sphere.clone(), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })); halo.scale.setScalar(1.28); mesh.add(halo); floorLines.push(pos, new THREE.Vector3(pos.x, -HALF, pos.z)); }
          const n = tag(esc(p.nameOf(q)), q.frontier ? "t3d-name" : "t3d-name t3d-under"); n.style.visibility = "hidden";
          anchors.push({ id: q.id, v: pos, node: n, ...sizeOf(n) });
        }
        sphere.dispose();
        if (floorLines.length) { const d = segments(floorLines, grey, 0.42, -3); drops.push(d); content.add(d); }
        // The picked or hovered model's three paths to the walls.
        paths = segments(Array.from({ length: 6 }, () => new THREE.Vector3()), ink, 0.8, 9); (paths.material as T.Material).depthTest = false; paths.frustumCulled = false; paths.visible = false; content.add(paths);
        pathDots = [0, 1, 2].map(() => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: ink })); d.visible = false; content.add(d); return d; });
        refresh();
      };

      const refresh = () => {
        const p = latest.current, hotId = p.selected ?? hoverId, hotPoint = hotId ? p.points.find((q) => q.id === hotId) : undefined;
        for (const d of drops) d.visible = p.dropLines;
        for (const s of surface) s.visible = p.frontier;
        for (const { mesh, id } of pickables) mesh.scale.setScalar((mesh.userData.r as number) * (id === p.selected ? 1.6 : id === hoverId ? 1.3 : 1));
        // The picked model's values, on the axes they belong to.
        if (hotPoint) for (const s of statics) if (s.chip && s.axis != null) { s.u = hotPoint.pos[s.axis]; s.node.textContent = p.axes[s.axis].meta.format(hotPoint.raw[s.axis]); Object.assign(s, sizeOf(s.node)); }
        controls.autoRotate = p.autoRotate && !p.selected && !hoverId;
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
