"use client";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { IndexConfig } from "@/engine";
import { authEnabled } from "@/app/providers";

export function HeaderAuth({ indices }: { indices: IndexConfig[] }) {
  if (!authEnabled) return <span className="btn-quiet opacity-60" title="Sign-in not configured yet">Claim your page</span>;
  return <Inner indices={indices} />;
}

function Inner({ indices }: { indices: IndexConfig[] }) {
  const { isSignedIn, user } = useUser();
  const mine = useQuery(api.profiles.mine, isSignedIn ? {} : "skip");
  const update = useMutation(api.profiles.update);
  const [saved, setSaved] = useState(false);
  const stash = () => sessionStorage.setItem("priors:pending", window.location.search);
  if (!isSignedIn) return <Link href="/sign-in" onClick={stash} className="btn">Claim your page</Link>;
  if (mine === undefined) return null;
  if (!mine) return <Link href="/claim" onClick={stash} className="btn">Claim your page</Link>;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn" onClick={async () => { await update({ patch: { indices } }); setSaved(true); setTimeout(() => setSaved(false), 1400); }}>{saved ? "Saved" : "Save to my page"}</button>
      <Link href={`/${mine.handle}`} className="flex items-center gap-2 btn-quiet">{user?.imageUrl && <img src={user.imageUrl} alt="" className="w-5 h-5 rounded-full" />}<span>@{mine.handle}</span></Link>
      <SignOutButton><button type="button" className="cap hover:text-ink">sign out</button></SignOutButton>
    </div>
  );
}
