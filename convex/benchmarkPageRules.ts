import type { BenchmarkBlock } from "./validators";

/**
 * Limits on what a benchmark's creators put on its page, and the one check every write goes through. Pure, so tests and the agent tools
 * share it. A Convex document holds at most 1 MiB, so the whole page stays under that with room for the rest of the row; anything larger
 * (audio, video, models, big data files) is loaded by the embed from the creator's own host.
 */
export const BLOCK_LIMITS = {
  blocks: 12,
  /** One embed's HTML. */
  html: 400_000,
  /** Every block together. */
  total: 900_000,
  title: 120,
  body: 20_000,
  minHeight: 60,
  maxHeight: 4000,
} as const;

export const BENCHMARK_ID = /^[a-z0-9][a-z0-9._:-]{0,119}$/i;
const BLOCK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export type BlockCheck = { ok: true; blocks: BenchmarkBlock[] } | { ok: false; error: string };

/** Keeps only stored fields, trims text, and refuses anything over a limit with a message an agent can act on. */
export function checkBlocks(input: unknown): BlockCheck {
  if (!Array.isArray(input)) return { ok: false, error: "blocks must be an array." };
  if (input.length > BLOCK_LIMITS.blocks) return { ok: false, error: `At most ${BLOCK_LIMITS.blocks} blocks; got ${input.length}.` };
  const seen = new Set<string>(), out: BenchmarkBlock[] = [];
  let total = 0;
  for (const [i, raw] of input.entries()) {
    const at = `blocks[${i}]`;
    if (!raw || typeof raw !== "object") return { ok: false, error: `${at} must be an object.` };
    const b = raw as Record<string, unknown>;
    const id = typeof b.id === "string" ? b.id.trim() : "";
    if (!BLOCK_ID.test(id)) return { ok: false, error: `${at}.id must be lowercase letters, digits and dashes (1 to 40), like "player".` };
    if (seen.has(id)) return { ok: false, error: `Two blocks have the id "${id}".` };
    seen.add(id);
    if (b.kind !== "embed" && b.kind !== "text") return { ok: false, error: `${at}.kind must be "embed" or "text".` };
    const block: BenchmarkBlock = { id, kind: b.kind };
    if (b.title !== undefined) {
      if (typeof b.title !== "string" || b.title.trim().length > BLOCK_LIMITS.title) return { ok: false, error: `${at}.title must be text of at most ${BLOCK_LIMITS.title} characters.` };
      if (b.title.trim()) block.title = b.title.trim();
    }
    if (b.kind === "text") {
      if (typeof b.body !== "string" || !b.body.trim()) return { ok: false, error: `${at} is a text block, so it needs a body.` };
      if (b.body.length > BLOCK_LIMITS.body) return { ok: false, error: `${at}.body is ${b.body.length} characters; the limit is ${BLOCK_LIMITS.body}.` };
      block.body = b.body.trim();
      total += block.body.length;
    } else {
      if (typeof b.html !== "string" || !b.html.trim()) return { ok: false, error: `${at} is an embed, so it needs html.` };
      if (b.html.length > BLOCK_LIMITS.html) return { ok: false, error: `${at}.html is ${b.html.length} characters; the limit is ${BLOCK_LIMITS.html}. Load big files (audio, images, data) from your own host instead of inlining them.` };
      block.html = b.html;
      total += b.html.length;
      if (b.height !== undefined && b.height !== null) {
        const h = Number(b.height);
        if (!Number.isFinite(h) || h < BLOCK_LIMITS.minHeight || h > BLOCK_LIMITS.maxHeight) return { ok: false, error: `${at}.height must be ${BLOCK_LIMITS.minHeight} to ${BLOCK_LIMITS.maxHeight} pixels, or left out to fit the content.` };
        block.height = Math.round(h);
      }
    }
    if (b.placement !== undefined) {
      if (b.placement !== "above" && b.placement !== "below") return { ok: false, error: `${at}.placement must be "above" or "below" (the leaderboard).` };
      if (b.placement === "above") block.placement = "above";
    }
    if (b.hidden === true) block.hidden = true;
    total += (block.title?.length ?? 0) + 64;
    out.push(block);
  }
  if (total > BLOCK_LIMITS.total) return { ok: false, error: `The blocks come to about ${total} characters; the page limit is ${BLOCK_LIMITS.total}. Move large content to your own host.` };
  return { ok: true, blocks: out };
}
