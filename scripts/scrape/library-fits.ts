/**
 * The library's lineup fits, spread over worker processes: on this machine and, when `PRIORS_FIT_REMOTE` names an ssh host,
 * on that machine too. Each fit is CPU-bound and independent, so they used to run one after another for ~3 minutes.
 *
 * Protocol (newline-delimited JSON over a worker's stdin/stdout, the same locally and through ssh):
 *   parent → worker: one job line { snapshotGz (base64), library, quality, known, fingerprint }, then one line per target
 *   worker → parent: { ready: true } once the job is read, then { i, fit?, rechecked, log } per target
 * The parent hands a target to whichever worker is free, so slow and fast machines both stay busy. A worker that dies or
 * never starts loses nothing: its target goes back on the queue. Local workers always run, so a missing remote only costs speed.
 *
 * Env: PRIORS_FIT_LOCAL (local workers, default 4), PRIORS_FIT_REMOTE (ssh host, unset = local only),
 * PRIORS_FIT_REMOTE_WORKERS (default 3), PRIORS_FIT_REMOTE_DIR (default priors-worker), PRIORS_FIT_REMOTE_SCALE (time-budget
 * multiplier for the remote's slower cores, default 2: fits stop on wall-clock budgets, so a slower core gets more time).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import type { FocusId, Snapshot } from "../../src/data/types";
import type { LibraryFit, MixLibrary } from "../../src/onboarding/library";
import { fitPriors } from "../../src/onboarding/optimizer";

export interface FitTarget { lineup: string[]; focus: FocusId; budget: number }
interface Job { snapshotGz: string; library: MixLibrary; quality: Record<string, number>; known: LibraryFit[]; fingerprint: string }
interface Result { i: number; fit?: LibraryFit; rechecked: boolean; log?: string }

/** One target: re-check the stored fit first (a zero soft budget stops at verification), search only if it no longer holds. */
async function fitOne(snapshot: Snapshot, job: Omit<Job, "snapshotGz">, t: FitTarget, found: LibraryFit[], scale: number): Promise<Omit<Result, "i">> {
  const key = `${t.focus}|${t.lineup.join(",")}`;
  const prior = job.known.filter((k) => k.focus === t.focus && k.lineup.join(",") === t.lineup.join(",")).sort((a, b) => b.fitScore - a.fitScore)[0];
  const run = (budget: { soft: number; hard: number }) => fitPriors(snapshot, t.lineup, () => {}, job.quality, 0, { baseline: t.lineup }, {
    focus: t.focus, library: job.library, extraFits: [...job.known, ...found], budgetMs: { soft: budget.soft * scale, hard: budget.hard * scale },
  });
  let done = prior ? await run({ soft: 0, hard: 8_000 }) : undefined;
  let rechecked = false;
  if (done && (done.exactMatch || done.fitScore >= prior!.fitScore - 1.5)) rechecked = true;
  else done = await run({ soft: t.budget, hard: t.budget + 10_000 });
  const c = done.config;
  const fit: LibraryFit = { lineup: t.lineup, focus: t.focus, weights: done.weights, fingerprint: job.fingerprint, settings: { strictness: c.strictness ?? 50, estimateMissing: c.estimateMissing, effortMatching: c.effortMatching ?? "calibrated" }, exact: done.exactMatch, fitScore: done.fitScore };
  return { fit, rechecked, log: `fit ${key.slice(0, 60)}…: ${done.exactMatch ? "exact" : "approx"} ${Math.round(done.fitScore)}%` };
}

/** Worker mode: `tsx scripts/scrape/library-fits.ts --worker`. */
async function worker() {
  const scale = Number(process.env.FIT_BUDGET_SCALE) || 1;
  const lines = createInterface({ input: process.stdin });
  let job: Omit<Job, "snapshotGz"> | undefined, snapshot: Snapshot | undefined;
  const found: LibraryFit[] = [];
  const send = (o: unknown) => process.stdout.write(JSON.stringify(o) + "\n");
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (!job) {
      const j = JSON.parse(line) as Job;
      snapshot = JSON.parse(gunzipSync(Buffer.from(j.snapshotGz, "base64")).toString("utf8")) as Snapshot;
      job = { library: j.library, quality: j.quality, known: j.known, fingerprint: j.fingerprint };
      send({ ready: true });
      continue;
    }
    const { i, target } = JSON.parse(line) as { i: number; target: FitTarget };
    try {
      const r = await fitOne(snapshot!, job, target, found, scale);
      if (r.fit) found.push(r.fit);
      send({ i, ...r });
    } catch (e) { send({ i, rechecked: false, log: `fit failed: ${e instanceof Error ? e.message : String(e)}` }); }
  }
}

interface Lane { name: string; proc: ChildProcess; ready: boolean; busy?: number; dead: boolean }

function startWorker(name: string, cmd: string, argv: string[], env?: NodeJS.ProcessEnv): Lane {
  const proc = spawn(cmd, argv, { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...env } });
  const lane: Lane = { name, proc, ready: false, dead: false };
  proc.stderr!.on("data", () => {});
  proc.stdin!.on("error", () => {});
  return lane;
}

const helpers = new Set<ChildProcess>();
const track = (p: ChildProcess) => { helpers.add(p); p.on("close", () => helpers.delete(p)); return p; };

/** Make the remote checkout match this one (code only) and install its dependencies when the lockfile changed. */
function prepareRemote(host: string, dir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rsync = spawn("rsync", ["-azL", "--delete", "--exclude", "node_modules", "--exclude", "/.git", "--exclude", "/data", "--exclude", "/.next", "--exclude", "/public", "--exclude", "/test-results",
      "--include", "package.json", "--include", "package-lock.json", "--include", "tsconfig.json", "--include", "src/***", "--include", "scripts/***", "--exclude", "*",
      "-e", "ssh -o ConnectTimeout=5 -o BatchMode=yes", "./", `${host}:${dir}/`], { stdio: "ignore" });
    track(rsync);
    const timer = setTimeout(() => rsync.kill(), 30_000);
    rsync.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return resolve(false);
      const install = `cd ${dir} && L=$(sha1sum package-lock.json | cut -d' ' -f1) && if [ "$L" != "$(cat node_modules/.lock-sha 2>/dev/null)" ]; then npm ci --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 && echo "$L" > node_modules/.lock-sha; fi && test -d node_modules/tsx`;
      const ssh = track(spawn("ssh", ["-o", "ConnectTimeout=5", "-o", "BatchMode=yes", host, install], { stdio: "ignore" }));
      const t2 = setTimeout(() => ssh.kill(), 300_000);
      ssh.on("close", (c) => { clearTimeout(t2); resolve(c === 0); });
    });
  });
}

/** Run every target across the workers. Results come back in target order; a target no worker could fit is left out. */
export async function fitInParallel(snapshot: Snapshot, job: Omit<Job, "snapshotGz">, targets: FitTarget[], log: (m: string) => void = console.log): Promise<{ fits: LibraryFit[]; rechecked: number; byWorker: Record<string, number> }> {
  if (!targets.length) return { fits: [], rechecked: 0, byWorker: {} };
  const jobLine = JSON.stringify({ ...job, snapshotGz: gzipSync(JSON.stringify(snapshot)).toString("base64") } satisfies Job) + "\n";
  const tsx = path.resolve("node_modules/.bin/tsx"), self = path.resolve("scripts/scrape/library-fits.ts");
  const nLocal = Math.max(1, Number(process.env.PRIORS_FIT_LOCAL ?? 4));
  const queue = targets.map((target, i) => ({ i, target }));
  const results = new Map<number, Result>();
  const byWorker: Record<string, number> = {};
  const lanes: Lane[] = [];
  let finish!: () => void;
  const allDone = new Promise<void>((r) => { finish = r; });
  const tryFinish = () => { if (results.size === targets.length) finish(); };
  const dispatch = (lane: Lane) => {
    if (lane.dead || !lane.ready || lane.busy !== undefined) return;
    const next = queue.shift();
    if (!next) { tryFinish(); return; }
    lane.busy = next.i;
    lane.proc.stdin!.write(JSON.stringify(next) + "\n");
  };
  const attach = (lane: Lane) => {
    lanes.push(lane);
    lane.proc.stdin!.write(jobLine);
    createInterface({ input: lane.proc.stdout! }).on("line", (line) => {
      let msg: Partial<Result> & { ready?: boolean };
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.ready) { lane.ready = true; dispatch(lane); return; }
      if (typeof msg.i !== "number") return;
      results.set(msg.i, msg as Result);
      byWorker[lane.name] = (byWorker[lane.name] ?? 0) + 1;
      if (msg.log) log(msg.log);
      lane.busy = undefined;
      dispatch(lane);
      tryFinish();
    });
    lane.proc.on("close", () => {
      lane.dead = true;
      if (lane.busy !== undefined && !results.has(lane.busy)) queue.unshift({ i: lane.busy, target: targets[lane.busy] });
      lane.busy = undefined;
      for (const l of lanes) dispatch(l);
      if (lanes.every((l) => l.dead)) finish();
      tryFinish();
    });
  };
  for (let k = 0; k < Math.min(nLocal, targets.length); k++) attach(startWorker(`local${k + 1}`, tsx, [self, "--worker"]));
  const host = process.env.PRIORS_FIT_REMOTE;
  if (host && targets.length > nLocal) {
    const dir = process.env.PRIORS_FIT_REMOTE_DIR ?? "priors-worker", n = Number(process.env.PRIORS_FIT_REMOTE_WORKERS ?? 3), scale = Number(process.env.PRIORS_FIT_REMOTE_SCALE ?? 2);
    void prepareRemote(host, dir).then((ok) => {
      if (!ok) { log(`fits: ${host} not available; local workers only`); return; }
      if (results.size === targets.length || !queue.length) return;
      for (let k = 0; k < n; k++) attach(startWorker(`${host}${k + 1}`, "ssh", ["-o", "ConnectTimeout=5", "-o", "BatchMode=yes", host, `cd ${dir} && FIT_BUDGET_SCALE=${scale} exec nice -n 10 node_modules/.bin/tsx scripts/scrape/library-fits.ts --worker`]));
    });
  }
  await allDone;
  for (const l of lanes) { l.proc.stdin!.end(); if (!l.dead) l.proc.kill(); }
  // A remote still syncing or installing when the local workers finished is not waited for.
  for (const h of helpers) h.kill();
  const ordered = targets.map((_, i) => results.get(i)).filter((r): r is Result => !!r);
  return { fits: ordered.flatMap((r) => (r.fit ? [r.fit] : [])), rechecked: ordered.filter((r) => r.rechecked).length, byWorker };
}

if (process.argv.includes("--worker")) worker().catch((e) => { console.error(e); process.exit(1); });
