"use client";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cleanRequest, FILE_KINDS, MAX_CONTACT, MAX_FILE_BYTES, MAX_FILES, MAX_TEXT, MAX_URL, REQUEST_KINDS, type RequestKind } from "../../../convex/requestRules";
import { authEnabled, convexEnabled } from "@/app/providers";
import { track } from "@/lib/analytics";
import { useUser } from "@/lib/auth";

type Send = (args: { kind: RequestKind; text: string; url?: string; contact?: string; context?: string; files?: Id<"requestFiles">[]; client?: string; website?: string }) => Promise<{ ok: true } | { ok: false; error: string }>;

/** Where a file goes before its report is sent (convex/http.ts). Convex serves HTTP routes from the `.convex.site` twin of its URL. */
const FILE_URL = `${(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site")}/request-file`;
const sizeOf = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
/** Uploads one file and returns the id the report carries. Throws the sentence to show when it cannot. */
async function upload(file: File, client: string | undefined): Promise<Id<"requestFiles">> {
  const res = await fetch(`${FILE_URL}?name=${encodeURIComponent(file.name)}${client ? `&client=${encodeURIComponent(client)}` : ""}`, { method: "POST", body: file });
  const body = await res.json().catch(() => null) as { ok?: true; id?: string; error?: string } | null;
  if (!res.ok || !body?.id) throw new Error(body?.error ?? `Could not upload ${file.name}. Try again.`);
  return body.id as Id<"requestFiles">;
}
/** What the form adds to a bug report by itself, so the sender does not have to describe their setup. */
function bugContext(): string {
  let from = "";
  try { const r = new URL(document.referrer); if (r.origin === location.origin) from = ` · from ${r.pathname}${r.search}`; } catch { /* no referrer */ }
  return `${navigator.userAgent} · ${innerWidth}x${innerHeight}${matchMedia("(prefers-color-scheme: dark)").matches ? " · dark" : ""}${from}`;
}

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

const COPY: Record<RequestKind, { choice: string; label: string; placeholder: string; link: string }> = {
  bug: { choice: "A bug", label: "What went wrong, and where", placeholder: "On my page the line under the tabs runs through the text below it. iPhone, Safari.", link: "Link to the page where it happens (optional)" },
  other: { choice: "Something else", label: "What do you want to say", placeholder: "A wrong score, a question, an idea.", link: "Link, if one helps (optional)" },
  benchmark: { choice: "A benchmark", label: "The benchmark and its publisher", placeholder: "Vending-Bench 2 by Andon Labs. It measures how well a model runs a small business over a long horizon.", link: "Link to its leaderboard or paper (optional)" },
  feature: { choice: "A feature", label: "What should Priors do", placeholder: "Let me pin two models side by side on the cost chart.", link: "Link that shows what you mean (optional)" },
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

/** `?kind=benchmark` opens the form on that choice (the import page links here that way). Read after hydration, so the server's HTML and the first render agree. */
const kindInUrl = () => { const k = new URLSearchParams(location.search).get("kind"); return (REQUEST_KINDS as readonly string[]).includes(k ?? "") ? k as RequestKind : null; };

function Form({ send, note }: { send: Send | null; note?: ReactNode }) {
  const linked = useSyncExternalStore(noChange, kindInUrl, () => null);
  const [picked, setKind] = useState<RequestKind | null>(null);
  const kind = picked ?? linked ?? "bug";
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const addFiles = (list: Iterable<File>) => {
    const next = [...files];
    for (const f of list) {
      if (next.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) continue;
      if (f.size > MAX_FILE_BYTES) return setError(`${f.name} is over ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
      if (next.length >= MAX_FILES) return setError(`Attach at most ${MAX_FILES} files.`);
      next.push(f);
    }
    setError(""); setFiles(next);
  };
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
      <h2 ref={done} tabIndex={-1} className="text-[24px] outline-none">Sent</h2>
      <p className="text-[14px] text-ink-2">Thanks. It went to Adam.{contact.trim() ? " Adam may write back to the contact you left." : ""}</p>
      <button type="button" className="btn-quiet" onClick={() => { setText(""); setUrl(""); setFiles([]); setState("idle"); }}>Send another</button>
    </div>
  );

  const copy = COPY[kind];
  return (
    <form className="grid gap-5 bg-white border hairline rounded-md p-5" noValidate data-backend={send ? "on" : "off"}
      onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } }}
      onSubmit={async (e) => {
      e.preventDefault();
      if (state === "busy") return;
      const cleaned = cleanRequest({ kind, text, url, contact, ...(kind === "bug" ? { context: bugContext() } : {}) });
      if (!cleaned.ok) return setError(cleaned.error);
      if (!send) return setError("Requests are not set up on this server.");
      const website = String(new FormData(e.currentTarget).get("website") ?? "");
      setError(""); setState("busy");
      try {
        const client = clientId(), ids: Id<"requestFiles">[] = [];
        // A script that filled the trap field is told it worked; nothing of its is uploaded either.
        if (!website) for (const [i, f] of files.entries()) {
          setProgress(`Uploading ${i + 1} of ${files.length}`);
          try { ids.push(await upload(f, client)); }
          catch (err) { setError(err instanceof TypeError ? `Could not upload ${f.name}. Check your connection and try again.` : (err as Error).message); setState("idle"); setProgress(""); return; }
        }
        setProgress("");
        const late = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15_000));
        const result = await Promise.race([send({ ...cleaned.value, ...(ids.length ? { files: ids } : {}), client, website: website || undefined }), late]);
        if (!result.ok) { setError(result.error); setState("idle"); return; }
        track("request_sent", { kind, files: ids.length });
        setState("done");
      } catch {
        setError("Could not send it. Check your connection and try again.");
        setState("idle"); setProgress("");
      }
    }}>
      <fieldset className="grid gap-2">
        <legend className="text-[13px] text-ink-2 mb-2">What is it?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {REQUEST_KINDS.map((k) => <label key={k} className="hit flex items-center gap-2 cursor-pointer"><input type="radio" name="kind" value={k} className="accent-indigo" checked={kind === k} onChange={() => { setKind(k); setError(""); }} />{COPY[k].choice}</label>)}
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
      <div className="grid gap-2 text-[13px]" data-request-files>
        <span className="text-ink-2">Screenshots, photos, recordings or logs (optional)</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="btn-quiet cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"><input type="file" multiple className="sr-only" accept="image/*,video/*,application/pdf,text/*,.log,.txt,.json,.har,.csv,.md" onChange={(e) => { addFiles(e.target.files ?? []); e.target.value = ""; }} />Attach files</label>
          <span className="text-[12.5px] text-grey">Up to {MAX_FILES}, {MAX_FILE_BYTES / 1024 / 1024} MB each: {FILE_KINDS}. Pasting a screenshot works too.</span>
        </div>
        {files.length > 0 && <ul className="grid gap-1.5" aria-label="Attached files">
          {files.map((f) => <li key={`${f.name}:${f.size}:${f.lastModified}`} className="flex items-center gap-3 border hairline rounded px-2.5 py-1.5 min-w-0">
            <span className="truncate min-w-0 text-ink">{f.name}</span>
            <span className="cap shrink-0 whitespace-nowrap">{sizeOf(f.size)}</span>
            <button type="button" className="ml-auto shrink-0 text-ink-2 hover:text-ink underline underline-offset-2" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))}>Remove</button>
          </li>)}
        </ul>}
      </div>
      <label className="grid gap-1.5 text-[13px]">
        <span className="text-ink-2">Email or X handle, if you want a reply (optional)</span>
        <input name="contact" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={MAX_CONTACT} value={contact} onChange={(e) => { setContact(e.target.value); setError(""); }} className="inp max-sm:!text-[16px]" />
      </label>
      {/* A trap for scripts that fill every field. People never see or reach it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden"><label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
      {note}
      {error && <p role="alert" className="text-[13px] text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn" disabled={!ready || state === "busy"}>{state === "busy" ? (progress || "Sending…") : "Send"}</button>
        <span className="text-[12.5px] text-grey" role={progress ? "status" : undefined}>Only Adam sees what you send.{kind === "bug" ? " A bug report also says which browser and screen size you are on." : ""}</span>
      </div>
    </form>
  );
}
