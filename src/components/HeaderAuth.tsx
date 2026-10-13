"use client";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { storableIndex } from "../../convex/validators";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { IndexConfig } from "@/engine";
import type { FromPage } from "@/lib/url";
import { stashForPublish } from "@/lib/share";
import { saveToPage } from "@/lib/page-layout";
import { authEnabled } from "@/app/providers";
import { track } from "@/lib/analytics";
import { useForgetResume } from "@/components/ResumeSignIn";

export function HeaderAuth({ indices }: { indices: IndexConfig[] }) {
  if (!authEnabled) return <span className="btn-quiet opacity-60" title="Sign-in not configured yet">Claim your page</span>;
  return <Inner indices={indices} />;
}

/** The id of my page's index this builder index was opened from, if it came from my page. */
const pageIndexId = (i: FromPage, handle: string) => i.page?.startsWith(`${handle}.`) ? i.page.slice(handle.length + 1) : undefined;

function Inner({ indices }: { indices: IndexConfig[] }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const update = useMutation(api.profiles.update);
  const forgetResume = useForgetResume();
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [knownHandle, setKnownHandle] = useState("");
  useEffect(() => { const id = requestAnimationFrame(() => setKnownHandle(localStorage.getItem("priors:handle") ?? "")); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { if (mine?.handle) localStorage.setItem("priors:handle", mine.handle); }, [mine?.handle]);
  const stash = () => stashForPublish(indices);
  if (!isLoaded) return <span className="text-xs text-grey">Loading account…</span>;
  if (!isSignedIn) return <div className="flex items-center gap-2">{knownHandle && <Link href={`/${knownHandle}`} transitionTypes={["nav-forward"]} className="btn-quiet">@{knownHandle}</Link>}<Link href="/sign-in" onClick={stash} transitionTypes={["nav-forward"]} className="btn-quiet max-sm:hidden">Sign in</Link><Link href="/sign-in" onClick={() => { track("publish_clicked", { from: "header" }); stash(); }} transitionTypes={["nav-forward"]} className="btn"><span className="sm:hidden">Publish</span><span className="hidden sm:inline">Publish to Explore</span></Link></div>;
  if (mine === undefined) return null;
  if (!mine) return <Link href="/claim" onClick={stash} transitionTypes={["nav-forward"]} className="btn">Publish to Explore</Link>;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { const next = saveToPage(mine.indices, indices.map(storableIndex), { from: indices.map((i) => pageIndexId(i, mine.handle)) }); await update({ patch: { indices: next.indices } }); setSaved(next.added.length ? "Added to your page" : "Saved"); setTimeout(() => setSaved(""), next.added.length ? 2600 : 1400); } catch (e) { console.error("Save to page failed", e); setError(e instanceof ConvexError ? String(e.data) : "Save failed. Please try again."); } finally { setSaving(false); } }}>{saving ? "Saving…" : saved || "Save to my page"}</button>
      <Link href={`/${mine.handle}`} transitionTypes={["nav-forward"]} className="flex items-center gap-2 btn-quiet">{(mine.avatarUrl ?? user?.imageUrl) && <img src={mine.avatarUrl ?? user?.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}<span>@{mine.handle}</span></Link>
      {error && <span role="alert" className="text-xs">{error}</span>}
      <SignOutButton><button type="button" className="cap hover:text-ink" onClick={forgetResume}>sign out</button></SignOutButton>
    </div>
  );
}
