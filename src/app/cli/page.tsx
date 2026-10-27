import Link from "next/link";
import { SettingsButton } from "@/components/SiteSettings";
import { Wordmark } from "@/components/Wordmark";
import { PageTransition } from "@/components/PageTransition";
import { pageMeta } from "@/lib/site-meta";
import { TOOLS } from "@/mcp/tools";
import { CopyBlock } from "./CopyBlock";

export const metadata = pageMeta({ title: "CLI and MCP", description: "Rank models, read every benchmark and run your Priors page from the terminal or from your own agent.", path: "/cli" });

const ORIGIN = "https://mypriors.com";
const props = (t: (typeof TOOLS)[number]) => {
  const s = t.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
  return Object.keys(s.properties ?? {}).map((k) => ((s.required ?? []).includes(k) ? `${k}*` : k)).join(", ");
};
const READ = TOOLS.filter((t) => !t.write), WRITE = TOOLS.filter((t) => t.write);

const CLAUDE_CODE = `claude mcp add --transport http priors ${ORIGIN}/mcp`;
const CLAUDE_CODE_TOKEN = `claude mcp add --transport http priors ${ORIGIN}/mcp \\\n  --header "Authorization: Bearer pri_your_token"`;
const JSON_CONFIG = `{\n  "mcpServers": {\n    "priors": {\n      "url": "${ORIGIN}/mcp",\n      "headers": { "Authorization": "Bearer pri_your_token" }\n    }\n  }\n}`;
const STDIO_CONFIG = `{\n  "mcpServers": {\n    "priors": {\n      "command": "priors",\n      "args": ["mcp"],\n      "env": { "PRIORS_TOKEN": "pri_your_token" }\n    }\n  }\n}`;
const CODEX = `[mcp_servers.priors]\ncommand = "priors"\nargs = ["mcp"]\nenv = { PRIORS_TOKEN = "pri_your_token" }`;
const CLI_EXAMPLES = `priors rank --top 10                        # the default General frontier index
priors rank --index @adamholter             # someone's published index, with their imported benchmarks
priors rank --weights simplebench:3,arc-agi-3:1 --lab anthropic
priors model "opus 5.5"                     # ranking plus every benchmark value
priors bench terminal-bench-4 --limit 15    # a leaderboard as published
priors compare "opus 5.5" "gpt-6.1 sol"     # points per benchmark behind the gap
priors history --mode adapting              # the ranking over time
priors link --index @adamholter             # builder, share-card and chart links

priors login pri_your_token                 # once, for your own page
priors whoami
priors index set coding.json                # add or change one index; the others stay
priors section set '{"id":"c","kind":"pareto","indexId":"coding"}' --at 1
priors theme --preset night --accent "#C2410C"
priors import mybench.json                  # your own benchmark's results
priors call fit_ranking order='["opus 5.5","gpt-6.1 sol","fable 5.1"]'`;

export default function CliPage() {
  return (
    <PageTransition><main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark transitionTypes={["nav-back"]} /><Link href="/builder" transitionTypes={["nav-back"]} className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><SettingsButton /></span></header>
      <div className="max-w-[860px] mx-auto px-8 py-12 grid gap-10">
        <div>
          <h1 className="text-[36px] mb-3">CLI and MCP</h1>
          <p className="text-[16px] text-ink-2 leading-relaxed max-w-[64ch]">Everything the site does, from a terminal or from your own agent: rank models under any index, read any benchmark, compare, chart, and, with your token, run your page. One set of {TOOLS.length} tools serves the MCP server, the CLI and a plain HTTP API, so they never disagree with each other or with mypriors.com.</p>
        </div>

        <section className="grid gap-3" id="mcp">
          <h2 className="text-[24px]">Connect an agent (MCP)</h2>
          <p className="text-[14px] text-ink-2">The hosted server needs no install. Reading is public. Tools that change your page read your agent token from the header, so add it only if you want your agent to edit your page.</p>
          <CopyBlock label="Claude Code" text={CLAUDE_CODE} />
          <CopyBlock label="Claude Code, with your token" text={CLAUDE_CODE_TOKEN} />
          <CopyBlock label="Cursor, Windsurf, Claude Desktop and other clients that take a URL (remote server)" text={JSON_CONFIG} />
          <p className="text-[14px] text-ink-2">Clients that only start local programs use the CLI as a stdio server instead (install it below first).</p>
          <CopyBlock label="Local server in any client's mcpServers" text={STDIO_CONFIG} />
          <CopyBlock label="Codex (~/.codex/config.toml)" text={CODEX} />
        </section>

        <section className="grid gap-3" id="cli">
          <h2 className="text-[24px]">Install the CLI</h2>
          <p className="text-[14px] text-ink-2">One file, no dependencies, Node 18 or newer.</p>
          <CopyBlock label="Install script (puts `priors` in ~/.local/bin)" text={`curl -fsSL ${ORIGIN}/install.sh | sh`} />
          <CopyBlock label="With npm" text={`npm install -g ${ORIGIN}/cli/priors-cli.tgz`} />
          <CopyBlock label="Without installing" text={`npx -y ${ORIGIN}/cli/priors-cli.tgz rank --top 10`} />
          <CopyBlock label="Update later" text="priors update" />
          <CopyBlock label="Examples" text={CLI_EXAMPLES} />
          <p className="text-[14px] text-ink-2">Add <code className="mono">--json</code> to any command for raw JSON. <code className="mono">priors tools</code> lists every tool and <code className="mono">priors call &lt;tool&gt; key=value …</code> runs any of them, so nothing in this page is out of the CLI&apos;s reach.</p>
        </section>

        <section className="grid gap-3" id="token">
          <h2 className="text-[24px]">Your agent token</h2>
          <p className="text-[14px] text-ink-2">To change your own page you need a token: on your page, Edit page, Agent access, Mint token. It looks like <code className="mono">pri_</code> and 48 characters, is shown once, and minting a new one replaces the old. Give it to the CLI with <code className="mono">priors login</code> (saved to <code className="mono">~/.config/priors/config.json</code>, readable only by you) or set <code className="mono">PRIORS_TOKEN</code>. No page yet? <Link href="/claim" className="underline">Claim a handle</Link> first; signing in, claiming a handle, uploading images and deleting a page stay in the browser.</p>
        </section>

        <section className="grid gap-3" id="index">
          <h2 className="text-[24px]">The <code className="mono">index</code> argument</h2>
          <p className="text-[14px] text-ink-2">Most read tools rank under an index. Leave it out for the default. Otherwise pass any of:</p>
          <ul className="grid gap-1.5 text-[14px] text-ink-2 list-disc pl-5">
            <li>a published page: <code className="mono">@handle</code>, or <code className="mono">@handle/index-id</code> for one of its tabs. That page&apos;s own imported benchmarks come along.</li>
            <li>a mypriors.com link, or the <code className="mono">i=</code> value from one (<code className="mono">decode_index_link</code> turns it into an editable object).</li>
            <li>an object: <code className="mono">{`{ "weights": { "simplebench": 3, "arc-agi-3": 1 }, "strictness": 80 }`}</code>. Any IndexConfig field works, merged onto the default.</li>
          </ul>
        </section>

        <section className="grid gap-3" id="rest">
          <h2 className="text-[24px]">Plain HTTP</h2>
          <CopyBlock text={`curl -s ${ORIGIN}/api/tools/rank_models -d '{"top":5,"index":{"weights":{"simplebench":1}}}'\ncurl -s ${ORIGIN}/api/tools            # the catalog with JSON schemas\ncurl -s ${ORIGIN}/api/tools/whoami -H "Authorization: Bearer $PRIORS_TOKEN" -d '{}'`} />
          <p className="text-[14px] text-ink-2">The MCP endpoint is <code className="mono">POST {ORIGIN}/mcp</code> (Streamable HTTP, stateless). Failures come back as <code className="mono">{`{ "error": "..." }`}</code> with the right status. The older <code className="mono">POST /api/agent</code> that the <Link href="/skill" className="underline">skill</Link> uses keeps working.</p>
        </section>

        <section className="grid gap-3" id="tools">
          <h2 className="text-[24px]">Read tools <span className="text-grey text-[14px]">public</span></h2>
          <ToolTable tools={READ} />
          <h2 className="text-[24px] mt-4">Page tools <span className="text-grey text-[14px]">need your token</span></h2>
          <ToolTable tools={WRITE} />
          <p className="text-[12.5px] text-grey">* required. The list above is generated from the running server.</p>
        </section>

        <section className="grid gap-2 text-[14px] text-ink-2" id="rules">
          <h2 className="text-[24px] text-ink">What stays true</h2>
          <p>Scores come back as published. Nothing is stretched, estimated or invented; a score the index had to estimate is marked by how much of it is measured (<code className="mono">measuredShare</code>). A model is a model plus a reasoning effort. Cost is measured cost per task, never token price. Tools that only compute (<code className="mono">try_mix</code>, <code className="mono">solve_edit</code>, <code className="mono">fit_ranking</code>) never save; saving is always an explicit <code className="mono">upsert_index</code>.</p>
          <p>Not covered: the in-app assistant (it needs a browser sign-in), claiming a handle, image uploads, deleting a page, and removing an imported benchmark (re-importing the same id replaces it).</p>
        </section>
      </div>
    </main></PageTransition>
  );
}

function ToolTable({ tools }: { tools: typeof TOOLS }) {
  return (
    <div className="grid border hairline rounded-md bg-white divide-y divide-[var(--hair-2)]">
      {tools.map((t) => (
        <div key={t.name} className="px-4 py-3 grid gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3"><code className="mono text-[13px] text-ink">{t.name}</code><span className="mono text-[12px] text-grey">{props(t) || "no arguments"}</span></div>
          <p className="text-[13.5px] text-ink-2 leading-relaxed">{t.description}</p>
        </div>
      ))}
    </div>
  );
}
