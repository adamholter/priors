import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { Wordmark } from "@/components/Wordmark";
import { PageTransition } from "@/components/PageTransition";
import { pageMeta } from "@/lib/site-meta";
import { TOOLS } from "@/mcp/tools";
import { CopyBlock } from "../cli/CopyBlock";

export const metadata = pageMeta({ title: "Tools", description: "Every way to use Priors from outside the site: the agent skill, the MCP server, the CLI, importing your own benchmark and exporting the data.", path: "/tools" });

const ORIGIN = "https://mypriors.com";
const EXPORT_HTTP = `curl -s ${ORIGIN}/api/benchmarks        # every benchmark and model
curl -s --compressed ${ORIGIN}/api/snapshot -o snapshot.json
curl -s --compressed "${ORIGIN}/api/snapshot?date=2026-11-01"`;
const EXPORT_CLI = `priors bench terminal-bench-4 --json > terminal-bench-4.json
priors rank --top 50 --json > ranking.json`;

const SECTIONS = [["skill", "Agent skill"], ["mcp", "MCP server"], ["cli", "CLI"], ["import", "Import"], ["export", "Export"]] as const;

/** One place for everything that reaches Priors from outside its pages. Each part keeps its own page for the detail. */
export default function ToolsPage() {
  return (
    <PageTransition><main className="min-h-screen">
      <header className="flex items-center gap-6 px-4 sm:px-8 h-14 border-b hairline"><Wordmark transitionTypes={["nav-back"]} /><Link href="/builder" transitionTypes={["nav-back"]} className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><SettingsButton /></span></header>
      <div className="max-w-[820px] mx-auto px-4 sm:px-8 py-12 grid gap-10">
        <div className="grid gap-4">
          <h1 className="text-[36px]">Tools</h1>
          <p className="text-[16px] text-ink-2 leading-relaxed max-w-[62ch]">Every way to use Priors from outside the site: from your own agent, from a terminal, or over plain HTTP. You can add a benchmark of your own and take the data out. Reading needs no account.</p>
          <nav aria-label="On this page" className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">{SECTIONS.map(([id, name]) => <a key={id} href={`#${id}`} className="text-indigo hover:underline">{name}</a>)}</nav>
        </div>

        <Part id="skill" title="Agent skill" more={<><Link href="/skill" className="text-indigo hover:underline">Get the skill</Link><a href="/skill/SKILL.md" className="text-ink-2 hover:text-ink underline underline-offset-2">Raw file</a></>}>
          <p>One file you give to Claude Code, Codex or any agent that reads skill files. It teaches the agent how to pull data out of Priors, how to add a benchmark to your page and how to edit the page when you ask. It is short, and fetches the detail for a task only when it needs it.</p>
        </Part>

        <Part id="mcp" title="MCP server" more={<Link href="/cli#mcp" className="text-indigo hover:underline">Other clients and all {TOOLS.length} tools</Link>}>
          <p>A hosted server at <code className="mono text-ink">{ORIGIN}/mcp</code> with {TOOLS.length} tools: rank models under any index, read a benchmark, compare, chart. Nothing to install. Reading is public, and the tools that change your page ask for your agent token.</p>
          <CopyBlock label="Claude Code" text={`claude mcp add --transport http priors ${ORIGIN}/mcp`} />
        </Part>

        <Part id="cli" title="CLI" more={<Link href="/cli#cli" className="text-indigo hover:underline">Every command</Link>}>
          <p>The same tools in a terminal. One file, no dependencies, Node 18 or newer.</p>
          <CopyBlock label="Install" text={`curl -fsSL ${ORIGIN}/install.sh | sh`} />
          <CopyBlock label="Try it" text={`priors rank --top 10\npriors model "opus 5.5"`} />
        </Part>

        <Part id="import" title="Import a benchmark" more={<><Link href="/import" className="text-indigo hover:underline">Import a benchmark</Link><Link href="/request" className="text-ink-2 hover:text-ink underline underline-offset-2">Ask for it to be added for everyone</Link></>}>
          <p>Add a benchmark Priors does not have and weight it like any other. Signed in, it joins your page; without an account it stays in this browser. Paste the results as JSON on the import page, have your agent produce the file with the skill, or run <code className="mono text-ink">priors import mybench.json</code>.</p>
        </Part>

        <Part id="export" title="Export data" more={<Link href="/cli#rest" className="text-indigo hover:underline">The HTTP API</Link>}>
          <p>Every chart has an export button: PNG or SVG for the picture, CSV or JSON for the numbers behind it. The data itself is open as JSON: the catalog of benchmarks and models, and the whole dataset behind the charts (about 18 MB) for today or any day since September 5, 2026. Any CLI command prints JSON with <code className="mono text-ink">--json</code>.</p>
          <CopyBlock label="Over HTTP" text={EXPORT_HTTP} />
          <CopyBlock label="With the CLI" text={EXPORT_CLI} />
        </Part>

        <section className="grid gap-2 border-t hairline pt-8 text-[14px] text-ink-2" id="token">
          <h2 className="text-[20px] text-ink">Changing your page needs a token</h2>
          <p>Reading is open to everyone. For the skill, the MCP server or the CLI to change your own page, mint an agent token on the page: Edit page, Agent access, Mint token. <Link href="/cli#token" className="text-indigo hover:underline">How the token works</Link></p>
        </section>
      </div>
      <SiteFooter />
    </main></PageTransition>
  );
}

function Part({ id, title, more, children }: { id: string; title: string; more: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="grid gap-3 min-w-0 scroll-mt-6 border-t hairline pt-8 text-[14.5px] text-ink-2 leading-relaxed">
      <h2 className="text-[24px] text-ink">{title}</h2>
      {children}
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">{more}</p>
    </section>
  );
}
