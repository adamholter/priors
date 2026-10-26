"use client";
import { useUser } from "@clerk/nextjs";
import { storableIndex } from "../../convex/validators";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { IndexConfig } from "@/engine";
import { PAGE_KEY, pageIndexId } from "@/lib/url";
import { stashForPublish } from "@/lib/share";
import { saveToPage } from "@/lib/page-layout";
import { authEnabled } from "@/app/providers";
import { track } from "@/lib/analytics";
import { AccountMenu } from "@/components/AccountMenu";

export function HeaderAuth({ indices }: { indices: IndexConfig[] }) {
  if (!authEnabled) return <span className="btn-quiet opacity-60" title="Sign-in not configured yet">Claim your page</span>;
  return <Inner indices={indices} />;
}

const pageKey = () => { try { return sessionStorage.getItem(PAGE_KEY); } catch { return null; } };

function Inner({ indices }: { indices: IndexConfig[] }) {
  const { isSignedIn, isLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const update = useMutation(api.profiles.update);
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
      <button type="button" className="icon-btn" aria-label="Save to my page" data-tip={saving ? "Saving…" : saved || "Save to my page"} data-tip-open={saving || saved ? "" : undefined} aria-busy={saving} disabled={saving} onClick={async () => { setSaving(true); setError(""); try { const next = saveToPage(mine.indices, indices.map(storableIndex), { from: indices.map((i) => pageIndexId(i, mine.handle, pageKey())) }); await update({ patch: { indices: next.indices } }); setSaved(next.added.length ? "Added to your page" : "Saved"); setTimeout(() => setSaved(""), next.added.length ? 2600 : 1400); } catch (e) { console.error("Save to page failed", e); setError(e instanceof ConvexError ? String(e.data) : "Save failed. Please try again."); } finally { setSaving(false); } }}><SaveIcon /></button>
      {error && <span role="alert" className="text-xs">{error}</span>}
      <AccountMenu />
    </div>
  );
}

/** A floppy disk: save this to my page. */
function SaveIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M7 3v5h8V3M7 21v-7h10v7" /></svg>;
}
