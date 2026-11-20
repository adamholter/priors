"use client";
/**
 * The star on a benchmark: a signed-in person's way to say it is worth watching. The count is public (it lifts the benchmark in the
 * directory's recommended order); signed out, the star leads to sign-in and back. Convex is only touched for a signed-in visitor.
 */
import Link from "next/link";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { api } from "../../../convex/_generated/api";
import { authEnabled, convexEnabled } from "@/app/providers";
import { useUser } from "@/lib/auth";
import { stashReturn } from "@/lib/share";
import { track } from "@/lib/analytics";
import "./benchmark-star.css";

type Stars = { mine: Set<string>; toggle: (id: string) => Promise<void>; ready: boolean };
const StarsContext = createContext<Stars | null>(null);

/** Wrap a page that shows stars: one subscription to the visitor's own stars, however many buttons it holds. */
export function BenchmarkStars({ children }: { children: ReactNode }) {
  const { isSignedIn } = useUser();
  return authEnabled && convexEnabled && isSignedIn ? <SignedIn>{children}</SignedIn> : <>{children}</>;
}

function SignedIn({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const stored = useQuery(api.benchmarkStars.mine, isAuthenticated ? {} : "skip");
  const send = useMutation(api.benchmarkStars.toggle);
  // What the person just clicked shows at once; the stored list catches up.
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());
  const value = useMemo<Stars>(() => {
    const mine = new Set(stored ?? []);
    for (const [id, on] of pending) if (on) mine.add(id); else mine.delete(id);
    return {
      mine, ready: stored !== undefined,
      toggle: async (id) => {
        const on = !mine.has(id);
        setPending((p) => new Map(p).set(id, on));
        try { await send({ benchmarkId: id }); track("benchmark_star", { benchmark: id, on }); }
        catch (e) { console.error("Star failed", e); }
        finally { setPending((p) => { const next = new Map(p); next.delete(id); return next; }); }
      },
    };
  }, [stored, pending, send]);
  return <StarsContext.Provider value={value}>{children}</StarsContext.Provider>;
}

/**
 * `count` is what the server counted when the page was made; the visitor's own click moves it by one right away.
 * `label` adds the word "Star" beside the icon (a benchmark's page); the directory shows the icon and count alone.
 */
export function BenchmarkStar({ id, name, count, label, className = "" }: { id: string; name: string; count: number; label?: boolean; className?: string }) {
  const stars = useContext(StarsContext);
  // Whether the server's count already included this visitor's star: fixed at the first answer, so later clicks move the number by one.
  const [counted, setCounted] = useState<boolean | null>(null);
  const on = !!stars?.mine.has(id);
  if (stars?.ready && counted === null) setCounted(on);
  const shown = Math.max(0, count + (stars?.ready && counted !== null ? Number(on) - Number(counted) : 0));
  const body = <>{on ? <IconStarFilled size={15} aria-hidden="true" /> : <IconStar size={15} stroke={1.6} aria-hidden="true" />}{label && <span>{on ? "Starred" : "Star"}</span>}{(shown > 0 || label) && <span className="num">{shown}</span>}</>;
  const cls = `bench-star ${on ? "is-on" : ""} ${className}`;
  if (!stars) return <Link href="/sign-in" prefetch={false} className={cls} data-benchmark-star={id} aria-label={`Sign in to star ${name}${shown ? `, ${shown} star${shown === 1 ? "" : "s"}` : ""}`} title="Sign in to star this benchmark" onClick={stashReturn}>{body}</Link>;
  return <button type="button" className={cls} data-benchmark-star={id} aria-pressed={on} aria-label={`${on ? "Unstar" : "Star"} ${name}${shown ? `, ${shown} star${shown === 1 ? "" : "s"}` : ""}`} title={on ? "Remove your star" : "Star this benchmark"} disabled={!stars.ready} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void stars.toggle(id); }}>{body}</button>;
}

/** A star with its own count and its own stars subscription, for a place outside a page that already has them (the info dialog). */
export function StandaloneBenchmarkStar({ id, name }: { id: string; name: string }) {
  return <BenchmarkStars>{convexEnabled ? <CountedStar id={id} name={name} /> : <BenchmarkStar id={id} name={name} count={0} label className="is-button" />}</BenchmarkStars>;
}

/** The count is fetched once, not subscribed to, and a failed fetch shows 0: a count must never take the page down with it. */
function CountedStar({ id, name }: { id: string; name: string }) {
  const convex = useConvex();
  const [count, setCount] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    let live = true;
    convex.query(api.benchmarkStars.counts, { ids: [id] }).then((c) => { if (live) setCount({ id, n: c[id] ?? 0 }); }, () => { if (live) setCount({ id, n: 0 }); });
    return () => { live = false; };
  }, [convex, id]);
  return <BenchmarkStar key={count?.id === id ? "counted" : "counting"} id={id} name={name} count={count?.id === id ? count.n : 0} label className="is-button" />;
}
