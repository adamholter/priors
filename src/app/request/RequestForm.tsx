"use client";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { cleanRequest, MAX_CONTACT, MAX_TEXT, MAX_URL, type RequestKind } from "../../../convex/requestRules";
import { authEnabled, convexEnabled } from "@/app/providers";
import { track } from "@/lib/analytics";
import { useUser } from "@/lib/auth";

type Send = (args: { kind: RequestKind; text: string; url?: string; contact?: string; client?: string; website?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;

const CLIENT_KEY = "priors:request-client";
/** A random id this browser keeps, so the server can space out requests from one sender. It names nobody. */
function clientId(): string | undefined {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(CLIENT_KEY, id); }
    return id;
  } catch { return undefined; }
}

/** False in the server's HTML and until React runs here: a press on Send before then would post the form the browser's way and lose it. */
const noChange = () => () => {};
const useHydrated = () => useSyncExternalStore(noChange, () => true, () => false);

const COPY: Record<RequestKind, { label: string; placeholder: string; link: string }> = {
  benchmark: { label: "The benchmark and its publisher", placeholder: "Vending-Bench 2 by Andon Labs. It measures how well a model runs a small business over a long horizon.", link: "Link to its leaderboard or paper (optional)" },
  feature: { label: "What should Priors do", placeholder: "Let me pin two models side by side on the cost chart.", link: "Link that shows what you mean (optional)" },
};

/** The form on /request. Without a backend (a local build with no Convex URL) it still renders and says so on submit. */
export function RequestForm() {
  return convexEnabled ? <Connected /> : <Form send={null} />;
}

function Connected() {
  const submit = useMutation(api.requests.submit);
  return <Form send={submit} note={authEnabled ? <SignedInNote /> : null} />;
}

/** Says whose request this is. The server attaches the handle from the sign-in itself; this only tells the sender. */
function SignedInNote() {
  const { isSignedIn } = useUser();
  const mine = useQuery(api.profiles.mine, isSignedIn ? {} : "skip");
  if (!mine) return null;
  return <p className="text-[13px] text-ink-2" data-request-handle>You are signed in, so this is sent with your page, <span className="text-ink">@{mine.handle}</span>.</p>;
}

function Form({ send, note }: { send: Send | null; note?: ReactNode }) {
  const [kind, setKind] = useState<RequestKind>("benchmark");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const ready = useHydrated();
  const done = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (state === "done") done.current?.focus(); }, [state]);

  if (state === "done") return (
    <div className="grid gap-3 justify-items-start bg-white border hairline rounded-md p-5" role="status">
      <h2 ref={done} tabIndex={-1} className="text-[24px] outline-none">Request sent</h2>
      <p className="text-[14px] text-ink-2">Thanks. It went to Adam.{contact.trim() ? " Adam may write back to the contact you left." : ""}</p>
      <button type="button" className="btn-quiet" onClick={() => { setText(""); setUrl(""); setState("idle"); }}>Send another</button>
    </div>
  );

  const copy = COPY[kind];
  return (
    <form className="grid gap-5 bg-white border hairline rounded-md p-5" noValidate data-backend={send ? "on" : "off"} onSubmit={async (e) => {
      e.preventDefault();
      if (state === "busy") return;
      const cleaned = cleanRequest({ kind, text, url, contact });
      if (!cleaned.ok) return setError(cleaned.error);
      if (!send) return setError("Requests are not set up on this server.");
      const website = String(new FormData(e.currentTarget).get("website") ?? "");
      setError(""); setState("busy");
      try {
        const late = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15_000));
        const result = await Promise.race([send({ ...cleaned.value, client: clientId(), website: website || undefined }), late]);
        if (!result.ok) { setError(result.error); setState("idle"); return; }
        track("request_sent", { kind });
        setState("done");
      } catch {
        setError("Could not send it. Check your connection and try again.");
        setState("idle");
      }
    }}>
      <fieldset className="grid gap-2">
        <legend className="text-[13px] text-ink-2 mb-2">What are you asking for?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {(["benchmark", "feature"] as const).map((k) => <label key={k} className="hit flex items-center gap-2 cursor-pointer"><input type="radio" name="kind" value={k} className="accent-indigo" checked={kind === k} onChange={() => { setKind(k); setError(""); }} />{k === "benchmark" ? "A benchmark" : "A feature"}</label>)}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-[13px]">
        <span className="flex items-baseline justify-between gap-3"><span className="text-ink-2">{copy.label}</span><span className="cap shrink-0 whitespace-nowrap" aria-hidden="true">{text.length} / {MAX_TEXT}</span></span>
        <textarea name="text" required rows={6} maxLength={MAX_TEXT} value={text} onChange={(e) => { setText(e.target.value); setError(""); }} placeholder={copy.placeholder} className="inp max-sm:!text-[16px] leading-relaxed" />
      </label>
      {kind === "benchmark" && <p className="text-[13px] text-ink-2 -mt-2">Need it today? You can also <Link href="/tools#import" className="text-indigo hover:underline">import it for your own page</Link>.</p>}
      <label className="grid gap-1.5 text-[13px]">
        <span className="text-ink-2">{copy.link}</span>
        <input name="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={MAX_URL} value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }} placeholder="https://" className="inp max-sm:!text-[16px]" />
      </label>
      <label className="grid gap-1.5 text-[13px]">
        <span className="text-ink-2">Email or X handle, if you want a reply (optional)</span>
        <input name="contact" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={MAX_CONTACT} value={contact} onChange={(e) => { setContact(e.target.value); setError(""); }} className="inp max-sm:!text-[16px]" />
      </label>
      {/* A trap for scripts that fill every field. People never see or reach it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden"><label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
      {note}
      {error && <p role="alert" className="text-[13px] text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn" disabled={!ready || state === "busy"}>{state === "busy" ? "Sending…" : "Send request"}</button>
        <span className="text-[12.5px] text-grey">Only Adam sees what you send.</span>
      </div>
    </form>
  );
}
