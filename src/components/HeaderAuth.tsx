"use client";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { IndexConfig } from "@/engine";
import { encodeIndices } from "@/lib/url";
import { authEnabled } from "@/app/providers";

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
  if (!isSignedIn) return <div className="flex items-center gap-2">{knownHandle && <Link href={`/${knownHandle}`} transitionTypes={["nav-forward"]} className="btn-quiet">@{knownHandle}</Link>}<Link href="/sign-in" onClick={stash} transitionTypes={["nav-forward"]} className="btn"><span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Sign in to get your page</span></Link></div>;
  if (mine === undefined) return null;
  if (!mine) return <Link href="/claim" onClick={stash} transitionTypes={["nav-forward"]} className="btn">Claim your page</Link>;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { await update({ patch: { indices } }); setSaved(true); setTimeout(() => setSaved(false), 1400); } catch { setError("Save failed. Please try again."); } finally { setSaving(false); } }}>{saving ? "Saving…" : saved ? "Saved" : "Save to my page"}</button>
      <Link href={`/${mine.handle}`} transitionTypes={["nav-forward"]} className="flex items-center gap-2 btn-quiet">{user?.imageUrl && <img src={user.imageUrl} alt="" className="w-5 h-5 rounded-full" />}<span>@{mine.handle}</span></Link>
      {error && <span role="alert" className="text-xs">{error}</span>}
      <SignOutButton><button type="button" className="cap hover:text-ink">sign out</button></SignOutButton>
    </div>
  );
}
