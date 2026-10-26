"use client";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { authEnabled, convexEnabled } from "@/app/providers";
import type { IndexConfig } from "@/engine";
import { decodeIndices } from "@/lib/url";
import type { PageData } from "./compare/choice";
import { loadPage } from "./compare/load-page";

/** The visitor's own page, when signed in with one: just its handle, loaded as a page once known. */
export function MineProbe({ onHandle }: { onHandle: (handle: string | null) => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  useEffect(() => { if (!isLoading && (!isAuthenticated || mine !== undefined)) onHandle(mine?.handle ?? null); }, [isAuthenticated, isLoading, mine, onHandle]);
  return null;
}

export function readBuilder(): IndexConfig[] {
  try { const saved = localStorage.getItem("priors:indices"); return saved ? decodeIndices(JSON.parse(saved) as string[]) : []; } catch { return []; }
}

/**
 * The visitor's own rankings: their published page (when signed in with one) and the indices in this browser's
 * builder. `ready` is true once both are known. Render `probe` once, anywhere in the tree.
 */
export function useMyRankings(): { probe: ReactNode; ready: boolean; handle: string | null | undefined; page: PageData | null | undefined; builder: IndexConfig[]; builderReady: boolean } {
  const [handle, setHandle] = useState<string | null | undefined>(authEnabled && convexEnabled ? undefined : null);
  const [page, setPage] = useState<PageData | null | undefined>();
  const [builder, setBuilder] = useState<IndexConfig[]>([]);
  const [builderReady, setBuilderReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => { setBuilder(readBuilder()); setBuilderReady(true); }); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { if (!handle) return; let live = true; void loadPage(handle).then((p) => { if (live) setPage(p); }).catch(() => { if (live) setPage(null); }); return () => { live = false; }; }, [handle]);
  const ready = handle !== undefined && builderReady && (!handle || page !== undefined);
  return { probe: authEnabled && convexEnabled ? <MineProbe onHandle={setHandle} /> : null, ready, handle, page, builder, builderReady };
}
