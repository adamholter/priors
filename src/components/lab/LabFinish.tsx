"use client";
import { useState } from "react";
import Link from "next/link";
import { IconArrowRight, IconX } from "@tabler/icons-react";
import type { FitUpdate } from "@/onboarding/optimizer";
import type { Model } from "@/data/types";
import { rankingSimilarity } from "@/onboarding/ranking-metric";
import { LabShareMenu } from "./LabShareMenu";
import "./sharing-lab.css";

export function LabFinish({ update, models, cardUrl, resultUrl, publicUrl, reference, onClose }: { update: FitUpdate; models: Map<string, Model>; cardUrl: string; resultUrl: string; publicUrl: string; reference?: string[]; onClose: () => void }) {
 const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [message, setMessage] = useState("");
 const mine = update.ranking.map(r => r.modelId), top = mine.slice(0, 5).map(id => models.get(id)?.name ?? id);
 const similarity = reference ? rankingSimilarity(mine, reference) : null;
 return <div className="done-body lab-finish">
  <button type="button" className="lab-finish-close" onClick={onClose} aria-label="Close result"><IconX size={18} /></button>
  <p className="done-cap">{update.exactMatch ? "Order matched" : `Closest fit, ${Math.round(update.fitScore)}%`} · {update.benchmarkCount} benchmarks</p>
  <h2 id="done-heading">Your index <em>is ready.</em></h2>
  <div className="lab-finish-card" aria-busy={!loaded && !failed}>
   {!loaded && !failed && <div className="lab-card-placeholder"><span>My priors</span><ol>{top.slice(0, 3).map(n => <li key={n}>{n}</li>)}</ol></div>}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img key={cardUrl} src={cardUrl} alt={`Your ranking: ${top.join(", ")}`} width={1200} height={630} onLoad={() => { setLoaded(true); setFailed(false); }} onError={() => setFailed(true)} style={{ opacity: loaded ? 1 : 0 }} />
   {failed && <p role="alert" className="lab-card-placeholder">The image could not load. <button type="button" onClick={() => { setFailed(false); setLoaded(false); const img = document.querySelector<HTMLImageElement>(".lab-finish-card img"); if (img) img.src = `${cardUrl}&retry=${Date.now()}`; }}>Retry</button></p>}
   <LabShareMenu imageUrl={cardUrl} link={publicUrl} top={top} onMessage={setMessage} />
  </div>
  {similarity !== null && reference && <p className="lab-finish-comparison"><strong>{Math.round(similarity)}% similarity</strong> to @demo.{mine[0] !== reference[0] && <> Different #1: {models.get(reference[0])?.name}.</>}</p>}
  {message && <p className="lab-share-status" role="status">{message}</p>}
  <Link className="primary-action lab-finish-cta" href={resultUrl as "/builder"}>Explore your index <IconArrowRight size={18} /></Link>
 </div>;
}
