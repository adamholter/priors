import { NextResponse } from "next/server";
import { EXAMPLE_THEME, parseThemeText, themeId, themePrompt } from "@/lib/custom-theme";

/** The format, as instructions an agent can read: `curl https://mypriors.com/api/theme`. */
export async function GET() {
  return new Response(themePrompt(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}

/** Validates a Priors theme file (JSON body, a code fence around it is fine) and says what to fix. Stores nothing. */
export async function POST(req: Request) {
  const text = (await req.text()).slice(0, 40_000);
  const r = parseThemeText(text);
  if (!r.ok) return NextResponse.json({ ok: false, errors: r.errors, example: EXAMPLE_THEME }, { status: 422 });
  return NextResponse.json({ ok: true, name: r.theme.name, modes: [r.theme.light && "light", r.theme.dark && "dark"].filter(Boolean), warnings: r.warnings, id: themeId(r.theme) });
}
