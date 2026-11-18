import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { parseReport, reportFileName } from "@/lib/extension-feedback";

const reply = (status: number, body: { ok: true; filesDropped?: number } | { ok: false; error: string }) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * A bug report or feature request from the AA Plus extension, stored with the ones from `/request`. The extension may only
 * reach this site, so its screenshots come through here on their way to the same upload route the form uses. A screenshot that
 * cannot be stored never costs the report. A custom header is required: a web page cannot send it across origins.
 */
export async function POST(request: Request) {
  if (!request.headers.get("x-aa-plus")) return reply(403, { ok: false, error: "This address is for the AA Plus extension." });
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return reply(503, { ok: false, error: "Reports are not available right now." });
  let form: FormData;
  try { form = await request.formData(); } catch { return reply(400, { ok: false, error: "That report could not be read." }); }
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const parsed = parseReport(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")), files);
  if (!parsed.ok) return reply(400, parsed);
  const site = convexUrl.replace(/\.convex\.cloud\/?$/, ".convex.site"), ids: Id<"requestFiles">[] = [];
  let filesDropped = 0;
  for (const file of files) {
    try {
      const q = new URLSearchParams({ name: reportFileName(file.name), ...(parsed.client ? { client: parsed.client } : {}) });
      const res = await fetch(`${site}/request-file?${q}`, { method: "POST", body: await file.arrayBuffer(), headers: { "content-type": file.type } });
      const body = await res.json() as { id?: string };
      if (res.ok && body.id) ids.push(body.id as Id<"requestFiles">); else filesDropped++;
    } catch { filesDropped++; }
  }
  try {
    const done = await new ConvexHttpClient(convexUrl).mutation(api.requests.submit, { ...parsed.value, ...(ids.length ? { files: ids } : {}), ...(parsed.client ? { client: parsed.client } : {}), ...(parsed.website ? { website: parsed.website } : {}) });
    return done.ok ? reply(200, { ok: true, ...(filesDropped ? { filesDropped } : {}) }) : reply(done.reason === "invalid" ? 400 : 429, { ok: false, error: done.error });
  } catch { return reply(502, { ok: false, error: "The report could not be saved. Try again in a moment." }); }
}
