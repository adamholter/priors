"use client";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { ImportPayload } from "@/lib/import";

export function ImportSave({ payload }: { payload: ImportPayload }) {
  const { isSignedIn } = useUser();
  const mine = useQuery(api.profiles.mine, isSignedIn ? {} : "skip");
  const add = useMutation(api.profiles.addImport);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  if (!isSignedIn) return <Link href="/sign-in" className="btn">Sign in to save to your page</Link>;
  if (!mine) return <Link href="/claim" className="btn">Claim a page to save</Link>;
  return (
    <span className="flex items-center gap-2">
      <button type="button" className="btn" disabled={state !== "idle"} onClick={async () => { setState("busy"); await add({ benchmark: payload.benchmark, rows: payload.rows }); setState("done"); }}>{state === "done" ? "Saved to your page" : state === "busy" ? "Saving…" : `Save to @${mine.handle}`}</button>
      {state === "done" && <Link href={`/${mine.handle}`} className="text-indigo text-[13px]">View page →</Link>}
    </span>
  );
}
