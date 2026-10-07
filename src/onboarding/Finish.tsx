"use client";
import { useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconX } from "@tabler/icons-react";
import type { FitUpdate } from "@/onboarding/optimizer";
import type { Model } from "@/data/types";
import { rankingSimilarity } from "@/onboarding/ranking-metric";
import { ShareMenu } from "@/components/ShareMenu";
import "@/components/share-menu.css";

export function Finish({ update, models, cardUrl, resultUrl, publicUrl, reference, referenceLabel = "this page", onClose }: { update: FitUpdate; models: Map<string, Model>; cardUrl: string; resultUrl: string; publicUrl: string; reference?: string[]; referenceLabel?: string; onClose: () => void }) {
 const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [message, setMessage] = useState("");
 const mine = update.ranking.map(r => r.modelId), top = mine.slice(0, 5).map(id => models.get(id)?.name ?? id);
 const similarity = reference ? rankingSimilarity(mine, reference) : null;
 return <div className="done-body finish">
  <button type="button" className="finish-close" onClick={onClose} aria-label="Close result"><IconX size={18} /></button>
  <p className="done-cap">{update.exactMatch ? "Order matched" : `Closest fit, ${Math.round(update.fitScore)}%`} · {update.benchmarkCount} benchmarks</p>
  <h2 id="done-heading">Your index <em>is ready.</em></h2>
  <div className="finish-card" aria-busy={!loaded && !failed}>
   {!loaded && !failed && <div className="finish-placeholder"><span>My priors</span><ol>{top.slice(0, 3).map(n => <li key={n}>{n}</li>)}</ol></div>}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img key={cardUrl} src={cardUrl} alt={`Your ranking: ${top.join(", ")}`} width={1200} height={630} onLoad={() => { setLoaded(true); setFailed(false); }} onError={() => setFailed(true)} style={{ opacity: loaded ? 1 : 0 }} />
   {failed && <p role="alert" className="finish-placeholder">The image could not load. <button type="button" onClick={() => { setFailed(false); setLoaded(false); const img = document.querySelector<HTMLImageElement>(".finish-card img"); if (img) img.src = `${cardUrl}&retry=${Date.now()}`; }}>Retry</button></p>}
   <ShareMenu imageUrl={cardUrl} link={publicUrl} top={top} onMessage={setMessage} />
  </div>
  {similarity !== null && reference && <p className="finish-comparison"><strong>{Math.round(similarity)}% similarity</strong> to {referenceLabel}.{mine[0] !== reference[0] && <> Different #1: {models.get(reference[0])?.name}.</>}</p>}
  {message && <p className="share-status" role="status">{message}</p>}
  <Link className="primary-action finish-cta" href={resultUrl as "/builder"}>Explore your index <IconArrowRight size={18} /></Link>
 </div>;
}
