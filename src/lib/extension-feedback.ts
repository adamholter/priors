import { cleanFileName, cleanRequest, type CleanRequest } from "../../convex/requestRules";

/** Screenshots a report from the extension may carry. The extension shrinks them first, so together they fit one request to the site. */
export const MAX_REPORT_FILES = 3, MAX_REPORT_BYTES = 4 * 1024 * 1024;
const KINDS = new Set(["bug", "feature", "other"]);

export type ReportFile = { name: string; type: string; size: number };
export type ParsedReport = { ok: true; value: CleanRequest; client?: string; website?: string } | { ok: false; error: string };

/** A report as the extension's form sends it. Everything is checked again by `requests:submit`; this only refuses what can never be stored. */
export function parseReport(fields: { kind?: unknown; text?: unknown; contact?: unknown; url?: unknown; context?: unknown; client?: unknown; website?: unknown }, files: ReportFile[] = []): ParsedReport {
  const str = (v: unknown) => typeof v === "string" ? v : "";
  if (!KINDS.has(str(fields.kind))) return { ok: false, error: "Choose what this is." };
  if (files.length > MAX_REPORT_FILES) return { ok: false, error: `Attach at most ${MAX_REPORT_FILES} screenshots.` };
  if (files.some((f) => !f.type.startsWith("image/")) || files.reduce((n, f) => n + f.size, 0) > MAX_REPORT_BYTES) return { ok: false, error: "Those screenshots are too large." };
  const cleaned = cleanRequest({ kind: str(fields.kind), text: str(fields.text), url: str(fields.url) || undefined, contact: str(fields.contact) || undefined, context: str(fields.context) || undefined });
  if (!cleaned.ok) return cleaned;
  const client = str(fields.client);
  return { ok: true, value: cleaned.value, ...(/^[A-Za-z0-9_-]{8,64}$/.test(client) ? { client } : {}), ...(str(fields.website) ? { website: str(fields.website) } : {}) };
}
/** The sender's address from the one header this host writes itself (anything else could be the sender's own word). Null when it is not an address. */
export function senderAddress(headers: Pick<Headers, "get">, onCloudflare: boolean): string | null {
  const ip = headers.get(onCloudflare ? "cf-connecting-ip" : "x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}
export const reportFileName = (name: string) => cleanFileName(name);
