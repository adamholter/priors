"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnswerChart } from "@/lib/answer-chart";
import { ExpandedChart } from "./AssistantAnswer";

/**
 * A chart opened from a link (`?chart=` next to the index's `i`): fetched from /api/chart, which redraws
 * it from the data, and shown over the page like an expanded chart. Closing it drops `chart` from the address.
 */
export function SharedChart({ highlight, onHighlight }: { highlight?: string[]; onHighlight: (items: string[]) => void }) {
  const [state, setState] = useState<{ chart?: AnswerChart; error?: string } | null>(null);
  useEffect(() => {
    const q = new URL(window.location.href).searchParams, c = q.get("chart"), i = q.get("i");
    if (!c || !i) return;
    const ctrl = new AbortController();
    const date = q.get("date");
    fetch(`/api/chart?${new URLSearchParams({ i, c, ...(date ? { date } : {}) })}`, { signal: ctrl.signal })
      .then(async (r) => { const j = await r.json().catch(() => ({})); setState(r.ok ? { chart: j.chart } : { error: j.error ?? "That chart can't be drawn." }); })
      .catch((e) => { if (!(e instanceof DOMException && e.name === "AbortError")) setState({ error: "That chart couldn't be loaded." }); });
    return () => ctrl.abort();
  }, []);
  const close = useCallback(() => {
    setState(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("chart");
    window.history.replaceState(null, "", url.toString());
  }, []);
  const h = useMemo(() => ({ items: highlight ?? [], set: onHighlight }), [highlight, onHighlight]);
  if (!state) return null;
  if (state.chart) return <ExpandedChart chart={state.chart} highlight={h} onClose={close} />;
  return <div className="assistant-toast" role="status">{state.error} <button type="button" className="text-control" onClick={close}>Dismiss</button></div>;
}
