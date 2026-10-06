"use client";
import { track } from "@/lib/analytics";
import { useUser } from "@clerk/nextjs";
import { storableIndex } from "../../../convex/validators";
import Link from "next/link";
import type { Route } from "next";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Wordmark } from "@/components/Wordmark";
import { decodeIndices } from "@/lib/url";
import { authEnabled } from "@/app/providers";
import { PageTransition } from "@/components/PageTransition";

/** After sign-in: pick a handle. Seeds the page with the indices from the URL the user came from. */
export default function ClaimPage() {
  if (!authEnabled) return <main className="p-10 grid gap-4"><Wordmark /><p className="text-ink-2">Sign-in isn’t configured yet.</p></main>;
  return <PageTransition><Claim /></PageTransition>;
}

function Claim() {
  const { user, isLoaded } = useUser();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const [handleInput, setHandleInput] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handle = handleInput ?? (user ? (user.username ?? user.firstName ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) : "");
  const setHandle = setHandleInput;
  const available = useQuery(api.profiles.handleAvailable, handle.length >= 2 ? { handle } : "skip");
  const claim = useMutation(api.profiles.claim);
  const pending = useMemo(() => { if (typeof window === "undefined") return []; const stored = localStorage.getItem("priors:pending") ?? sessionStorage.getItem("priors:pending"); return stored ? decodeIndices(new URLSearchParams(stored)) : []; }, []);
  const [stuck, setStuck] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStuck(true), 12000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (isLoaded && !user) router.replace("/sign-in");
    else if (mine) {
      localStorage.setItem("priors:handle", mine.handle);
      const ret = localStorage.getItem("priors:return");
      router.replace(ret && ret.startsWith("/") && !ret.startsWith("//") && !ret.startsWith("/claim") && !ret.startsWith("/sign-in") ? ret as Route : `/${mine.handle}`);
    }
  }, [mine, router, isLoaded, user]);

  if (!isLoaded || !user || authLoading || mine === undefined) return (
    <main className="min-h-screen grid place-items-center p-8" role="status">
      <div className="grid gap-6 justify-items-center w-full max-w-[320px]">
        <Wordmark size={30} />
        {stuck ? <>
          <p className="text-[13px] text-ink-2 text-center">Couldn’t reach your account.</p>
          <button type="button" className="btn" onClick={() => { setStuck(false); window.location.reload(); }}>Try again</button>
          <Link href="/" className="cap hover:text-ink">back to explorer</Link>
        </> : <>
          <p className="cap">loading your account</p>
          <span className="claim-load-bar" aria-hidden="true" />
        </>}
      </div>
    </main>
  );

  return (
    <main className="min-h-screen grid place-items-center p-8">
      <form className="grid gap-5 w-full max-w-[380px]" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr(null);
        try { await claim({ handle, displayName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.primaryEmailAddress?.emailAddress.split("@")[0] || handle, avatarUrl: user.externalAccounts.find((a) => /google/.test(a.provider))?.imageUrl || (user.hasImage ? user.imageUrl : undefined), indices: pending.map(storableIndex) }); localStorage.removeItem("priors:pending"); sessionStorage.removeItem("priors:pending"); localStorage.setItem("priors:handle", handle); track("profile_claimed", { handle }); router.replace(`/${handle}?edit=1`); }
        catch (x) { setErr((x as Error).message.replace(/^[\s\S]*Uncaught Error:\s*/, "").split("\n")[0]); setBusy(false); }
      }}>
        <Wordmark size={30} />
        <h1 className="text-[28px]">Pick your handle</h1>
        <label className="grid gap-1.5 text-[13px]">
          <span className="text-ink-2">Your page will live at</span>
          <span className="flex items-center gap-0 border hairline rounded-sm bg-white px-3 h-10 focus-within:border-ink"><span className="text-grey mono">mypriors.com/</span><input autoFocus value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))} aria-label="Your handle" className="handle-input min-w-0 flex-1 bg-transparent outline-none mono" placeholder="adam" /></span>
          <span className="cap h-4">{handle.length >= 2 && available === false ? "taken or not allowed" : handle.length >= 2 && available ? "available" : ""}</span>
        </label>
        {pending.length > 0 && <p className="text-[12.5px] text-ink-2">Your {pending.length === 1 ? "index" : `${pending.length} indices`} ({pending.map((p) => p.name).join(", ")}) will be saved to the page.</p>}
        {err && <p className="text-[12.5px]" style={{ color: "#A0403A" }}>{err}</p>}
        <button className="btn" disabled={busy || !available}>{busy ? "Creating…" : "Create my page"}</button>
      </form>
    </main>
  );
}
