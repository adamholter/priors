"use client";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { storableIndex } from "../../convex/validators";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { IndexConfig } from "@/engine";
import { encodeIndices } from "@/lib/url";
import { authEnabled } from "@/app/providers";
import { track } from "@/lib/analytics";

export function HeaderAuth({ indices }: { indices: IndexConfig[] }) {
  if (!authEnabled) return <span className="btn-quiet opacity-60" title="Sign-in not configured yet">Claim your page</span>;
  return <Inner indices={indices} />;
}

function Inner({ indices }: { indices: IndexConfig[] }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const update = useMutation(api.profiles.update);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [knownHandle, setKnownHandle] = useState("");
  useEffect(() => { const id = requestAnimationFrame(() => setKnownHandle(localStorage.getItem("priors:handle") ?? "")); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { if (mine?.handle) localStorage.setItem("priors:handle", mine.handle); }, [mine?.handle]);
  // localStorage, not sessionStorage: OAuth sign-in hops through another origin and drops session state.
  const stash = () => { try { localStorage.setItem("priors:pending", encodeIndices(indices).toString()); localStorage.setItem("priors:return", window.location.pathname + window.location.search); } catch { /* private mode */ } };
  if (!isLoaded) return <span className="text-xs text-grey">Loading account…</span>;
  if (!isSignedIn) return <div className="flex items-center gap-2">{knownHandle && <Link href={`/${knownHandle}`} transitionTypes={["nav-forward"]} className="btn-quiet">@{knownHandle}</Link>}<Link href="/sign-in" onClick={() => { track("publish_clicked", { from: "header" }); stash(); }} transitionTypes={["nav-forward"]} className="btn"><span className="sm:hidden">Publish</span><span className="hidden sm:inline">Publish to Explore</span></Link></div>;
  if (mine === undefined) return null;
  if (!mine) return <Link href="/claim" onClick={stash} transitionTypes={["nav-forward"]} className="btn">Publish to Explore</Link>;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await update({ patch: { indices: indices.map(storableIndex) } }); setSaved(true); setTimeout(() => setSaved(false), 1400); } catch (e) { console.error("Save to page failed", e); setError(e instanceof ConvexError ? String(e.data) : "Save failed. Please try again."); } finally { setSaving(false); } }}>{saving ? "Saving…" : saved ? "Saved" : "Save to my page"}</button>
      <Link href={`/${mine.handle}`} transitionTypes={["nav-forward"]} className="flex items-center gap-2 btn-quiet">{(mine.avatarUrl ?? user?.imageUrl) && <img src={mine.avatarUrl ?? user?.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}<span>@{mine.handle}</span></Link>
      {error && <span role="alert" className="text-xs">{error}</span>}
      <SignOutButton><button type="button" className="cap hover:text-ink">sign out</button></SignOutButton>
    </div>
  );
}
