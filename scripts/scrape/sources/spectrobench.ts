/**
 * SpectroBench (SSHCodes, spectrobench.ssh.codes, announced 2026-11-27 at x.com/SSHCodes/status/2126402828272902355): each model
 * writes plain Python (numpy/scipy only; an AST audit bans FFT/STFT, audio and TTS libraries) that paints a 513 × T speech
 * spectrogram from acoustic-phonetic memory. A fixed blind Griffin-Lim inverter turns it into sound, scored 0–100 per clip:
 * 45% phonetic accuracy (LM-free IPA PER + CTC + Whisper), 35% voice quality (UTMOS22, WavLM similarity to real voices,
 * cleanliness, prosody), 20% STFT physics. Real human clips through the same pipeline are the 100 ceiling.
 *
 * Data: the site's own `data.json` holds every clip's scores (12 models × 12 prompts in three rounds). A model's score is the mean
 * of its clip scores and the interval is 1.96 × the standard error across prompts, both exactly as the site's leaderboard
 * computes them (app.js `summarizeModels`), which also match the results image in the announcement.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const SPECTRO_ID = "spectrobench";
export const SPECTRO_URL = "https://spectrobench.ssh.codes";

interface Clip { round: number; overall: number | null; accuracy: number | null; voice_quality: number | null; physics: number | null; utmos22: number | null; audit_passed?: boolean }
export interface SpectroData {
  generated_at: string; total_clips: number;
  spec: { ceiling_utmos?: number };
  prompts: { id: string }[];
  models: { id: string; label: string; lab: string; clips: Record<string, Clip> }[];
}

const fail = (what: string): never => { throw new Error(`SpectroBench: ${what}; the site's data.json changed?`); };
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const se = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length); };
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function parseSpectro(data: SpectroData): { rows: RawRow[]; benchmark: Benchmark } {
  if (!Array.isArray(data.models) || data.models.length < 5) fail(`only ${data.models?.length ?? 0} models`);
  const prompts = data.prompts.map((p) => p.id);
  if (prompts.length < 6) fail(`only ${prompts.length} prompts`);
  const scored = data.models.map((m) => {
    const clips = prompts.map((p) => m.clips[p]).filter((c): c is Clip => !!c && num(c.overall));
    // A model must have every prompt; a partial run would be scored on an easier subset.
    if (clips.length !== prompts.length) fail(`${m.label} has ${clips.length} of ${prompts.length} scored clips`);
    const pillar = (k: "accuracy" | "voice_quality" | "physics") => round(mean(clips.map((c) => c[k] ?? 0)), 1);
    return {
      m, clips, value: mean(clips.map((c) => c.overall!)), ci95: 1.96 * se(clips.map((c) => c.overall!)),
      accuracy: pillar("accuracy"), voiceQuality: pillar("voice_quality"), physics: pillar("physics"),
      utmos: round(mean(clips.map((c) => c.utmos22 ?? 1.2)), 2), // the site counts a clip UTMOS22 could not score as 1.2
    };
  }).sort((a, b) => b.value - a.value);
  const rows: RawRow[] = scored.map((s, i) => ({
    benchmarkId: SPECTRO_ID, modelLabel: s.m.label, value: round(s.value), rank: i + 1, sourceUrl: SPECTRO_URL,
    ci: [round(s.value - s.ci95), round(s.value + s.ci95)],
    note: `Mean composite score over ${s.clips.length} prompts (real human speech through the same pipeline = 100); accuracy ${s.accuracy}, voice quality ${s.voiceQuality}, physics ${s.physics}, UTMOS22 ${s.utmos}; the interval is the 95% CI across prompts`,
    details: {
      prompts: s.clips.length, accuracy: s.accuracy, voiceQuality: s.voiceQuality, physics: s.physics, utmos22: s.utmos,
      humanUtmos22: data.spec.ceiling_utmos, auditPassed: s.clips.every((c) => c.audit_passed !== false),
      promptScores: Object.fromEntries(prompts.map((p) => [p, round(s.m.clips[p].overall!, 1)])),
    },
  }));
  const benchmark: Benchmark = {
    id: SPECTRO_ID, sourceId: SPECTRO_ID, name: "SpectroBench", url: SPECTRO_URL, unit: "score", higherIsBetter: true, lastUpdated: data.generated_at,
    category: "creative", categories: ["creative", "knowledge"], normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
    description: "Can a model speak by drawing? Each model writes numpy code that paints a speech spectrogram from memory, with no audio or TTS tools, and a fixed inverter turns it into sound. Scored on how intelligible the words are (45%), how natural the voice sounds (35%) and spectrogram physics (20%), where real human speech is 100. Mean over 12 prompts.",
  };
  return { rows, benchmark };
}

const source: Source = {
  id: SPECTRO_ID, name: "SpectroBench", url: SPECTRO_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(`${SPECTRO_URL}/data.json`);
    const { rows, benchmark } = parseSpectro(JSON.parse(text) as SpectroData);
    return { benchmarks: [benchmark], rows, raw: { "data.json": text }, notes: [`${rows.length} models, #1 ${rows[0].modelLabel} ${rows[0].value}`] };
  },
};
export default source;
