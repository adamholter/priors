"use client";
/**
 * What a benchmark's verified creators put on its page: a byline under the title and their blocks around the leaderboard. Visitors get
 * the server's copy (visible blocks only). A signed-in creator also subscribes to the editor copy, so hidden blocks show to them, marked,
 * and an agent's write appears on their open page as it lands. Embeds run in `EmbedFrame`, sandboxed (`src/lib/benchmark-embed.ts`).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconUserCheck } from "@tabler/icons-react";
import { api } from "../../../convex/_generated/api";
import type { BenchmarkBlock } from "../../../convex/validators";
import { authEnabled, convexEnabled } from "@/app/providers";
import { useUser } from "@/lib/auth";
import { clampHeight, DEFAULT_EMBED_HEIGHT, EMBED_ALLOW, EMBED_SANDBOX, embedDocument, hasUserActivation, isFrameMessage, readEmbedTheme, safeExternalUrl, safeInternalPath, type EmbedBenchmark, type EmbedRow, type PageMessage } from "@/lib/benchmark-embed";
import "./creator-blocks.css";

export interface Creator { handle: string; displayName: string; avatarUrl?: string }
/** The public copy, as `benchmarkPages.byBenchmark` returns it. */
export interface CreatorPage { creators: Creator[]; blocks: BenchmarkBlock[]; updatedAt: number | null }

type View = { creators: Creator[]; blocks: BenchmarkBlock[]; editor: string | null; benchmark: EmbedBenchmark; rows: EmbedRow[] };
const CreatorContext = createContext<View | null>(null);

/** Wrap the benchmark page once; the byline and the block groups read from it. */
export function CreatorPageProvider({ page, benchmark, rows, children }: { page: CreatorPage | null; benchmark: EmbedBenchmark; rows: EmbedRow[]; children: ReactNode }) {
  const { isSignedIn } = useUser();
  // The benchmark rides into each frame's document, so it must stay the same object while its fields do (a new one would reload every frame).
  const key = JSON.stringify(benchmark);
  const stable = useMemo(() => JSON.parse(key) as EmbedBenchmark, [key]);
  const base = useMemo<View>(() => ({ creators: page?.creators ?? [], blocks: page?.blocks ?? [], editor: null, benchmark: stable, rows }), [page, stable, rows]);
  // Only a page with verified creators can have an editor, so nobody else's visit touches Convex.
  if (authEnabled && convexEnabled && isSignedIn && base.creators.length) return <EditorView base={base}>{children}</EditorView>;
  return <CreatorContext.Provider value={base}>{children}</CreatorContext.Provider>;
}

function EditorView({ base, children }: { base: View; children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.benchmarkPages.forEditor, isAuthenticated ? { benchmarkId: base.benchmark.id } : "skip");
  const value = useMemo<View>(() => (mine ? { ...base, blocks: mine.blocks, editor: mine.handle } : base), [base, mine]);
  return <CreatorContext.Provider value={value}>{children}</CreatorContext.Provider>;
}

/** "By <name>, verified creator", under the title. For a creator, also how to edit the page. */
export function CreatorByline() {
  const view = useContext(CreatorContext);
  if (!view?.creators.length) return null;
  return (
    <div className="grid gap-1" data-creator-byline>
      <p className="text-[13px] text-ink-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1" title="Priors confirmed this person makes the benchmark"><IconUserCheck size={15} stroke={1.6} aria-hidden="true" style={{ color: "var(--indigo)" }} />Verified creator{view.creators.length > 1 ? "s" : ""}</span>
        {view.creators.map((c, i) => <span key={c.handle} className="inline-flex items-center gap-1.5">{i > 0 && <span aria-hidden="true">·</span>}
          {c.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt="" width={18} height={18} className="w-[18px] h-[18px] rounded-full object-cover" />
          )}
          <Link href={`/${c.handle}` as "/"} className="text-ink hover:underline underline-offset-2">{c.displayName}</Link></span>)}
      </p>
      {view.editor && <p className="text-[12.5px] text-ink-2" data-creator-editor>You can change this page: give your agent the <Link href="/skill" className="underline underline-offset-2 hover:text-ink">Priors skill</Link> and your page&rsquo;s agent token (<Link href={`/${view.editor}?edit=1` as "/"} className="underline underline-offset-2 hover:text-ink">Edit page → Agent access</Link>), then ask it for what you want here. Hidden blocks show only to you.</p>}
    </div>
  );
}

/** The creators' blocks for one place on the page, above or below the leaderboard. */
export function CreatorBlocks({ placement }: { placement: "above" | "below" }) {
  const view = useContext(CreatorContext);
  const blocks = (view?.blocks ?? []).filter((b) => (b.placement ?? "below") === placement);
  if (!view || !blocks.length) return null;
  const who = view.creators.length === 1 ? view.creators[0].displayName : "the creators";
  return (
    <section className="grid gap-8" data-creator-blocks={placement} aria-label={`From ${who}`}>
      {blocks.map((b) => (
        <div key={b.id} id={`creator-${b.id}`} data-creator-block={b.id} className={`grid gap-3 ${b.hidden ? "creator-hidden-block" : ""}`}>
          {(b.title || b.hidden) && <div className="flex items-baseline justify-between gap-3 border-b hairline pb-2">
            {b.title ? <h2 className="text-[22px] sm:text-[26px]">{b.title}</h2> : <span />}
            <span className="cap">{b.hidden ? "Hidden · only creators see this" : `From ${who}`}</span>
          </div>}
          {b.kind === "text" ? <p className="text-[15.5px] leading-[1.7] text-ink-2 whitespace-pre-wrap max-w-[68ch]">{b.body}</p>
            : <EmbedFrame block={b} benchmark={view.benchmark} rows={view.rows} />}
        </div>
      ))}
    </section>
  );
}

/**
 * One embed. The document is built once on the client with the theme showing at that moment; later theme changes are sent as messages,
 * so a playing clip or a running game keeps its state. Messages are answered only when they come from this frame, and the two that leave
 * the page (open a Priors page, open a link) only right after a real click.
 */
function EmbedFrame({ block, benchmark, rows }: { block: BenchmarkBlock; benchmark: EmbedBenchmark; rows: EmbedRow[] }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [doc, setDoc] = useState<string | null>(null);
  // A fixed height wins; otherwise the height the frame last reported.
  const [measured, setMeasured] = useState(DEFAULT_EMBED_HEIGHT);
  const height = block.height ?? measured;
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the document needs the page's computed theme, which exists only in the browser
  useEffect(() => { setDoc(embedDocument(block.html ?? "", { benchmark, theme: readEmbedTheme() })); }, [block.html, benchmark]);

  useEffect(() => {
    const post = (m: PageMessage) => ref.current?.contentWindow?.postMessage(m, "*");
    const onMessage = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow || !isFrameMessage(e.data)) return;
      const m = e.data;
      if (m.type === "height") setMeasured(clampHeight(m.height));
      else if (m.type === "rows") post({ priors: 1, type: "rows", id: m.id, rows: rowsRef.current });
      else if (m.type === "open") { const path = safeInternalPath(m.path); if (path && hasUserActivation()) router.push(path as "/"); }
      else if (m.type === "link") { const url = safeExternalUrl(m.url); if (url && hasUserActivation()) window.open(url, "_blank", "noopener,noreferrer"); }
    };
    addEventListener("message", onMessage);
    // The page's theme lives on <html>: light/dark, a site theme's inline tokens, a custom page theme.
    const observer = new MutationObserver(() => post({ priors: 1, type: "theme", theme: readEmbedTheme() }));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "data-site-theme", "class"] });
    return () => { removeEventListener("message", onMessage); observer.disconnect(); };
  }, [router]);

  return (
    <div className="creator-embed" style={{ height }}>
      {doc && <iframe ref={ref} title={block.title ?? `${benchmark.name}: from the creator`} srcDoc={doc} sandbox={EMBED_SANDBOX} allow={EMBED_ALLOW} allowFullScreen loading="lazy" referrerPolicy="no-referrer"
        className="block w-full h-full border-0 bg-transparent" />}
    </div>
  );
}
