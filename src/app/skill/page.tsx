import { SettingsButton } from "@/components/SiteSettings";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { PageTransition } from "@/components/PageTransition";
import { CopySkill } from "./CopySkill";
import { pageMeta } from "@/lib/site-meta";
import { readRuntimeFile } from "@/lib/runtime-files";

export const metadata = pageMeta({ title: "Agent skill", description: "A skill that lets your own agent read and export Priors data, add benchmarks and edit your page.", path: "/skill" });

export default async function SkillPage() {
  const md = (await readRuntimeFile("public/skill/SKILL.md")).toString("utf8");
  return (
    <PageTransition><main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark transitionTypes={["nav-back"]} /><Link href="/builder" transitionTypes={["nav-back"]} className="text-grey text-[13px] hover:text-ink">Builder</Link><Link href="/tools" transitionTypes={["nav-back"]} className="text-grey text-[13px] hover:text-ink">Tools</Link><span className="ml-auto"><SettingsButton /></span></header>
      <div className="max-w-[820px] mx-auto px-8 py-12 grid gap-8">
        <div>
          <h1 className="text-[36px] mb-3">One skill for your agent</h1>
          <p className="text-[16px] text-ink-2 leading-relaxed max-w-[62ch]">Install it in Claude Code, Codex, or any agent that reads skill files, or paste it into a chat. It tells the agent how to get data out of Priors, how to research a benchmark you want and add it to your page, and how to restyle or rewrite your page when you ask. It also says where the code is, so your agent can work on Priors itself.</p>
        </div>
        <CopySkill md={md} />
        <div className="grid gap-3 text-[14px] text-ink-2">
          <p><span className="text-ink">Install:</span> save as <code className="mono">.claude/skills/priors/SKILL.md</code> (Claude Code), <code className="mono">.codex/skills/priors/SKILL.md</code> (Codex), or <code className="mono">.agents/skills/priors/SKILL.md</code>. Raw file: <a href="/skill/SKILL.md" className="text-indigo">/skill/SKILL.md</a></p>
          <p><span className="text-ink">Prefer tools to a skill?</span> The <Link href="/cli" className="underline">CLI and MCP server</Link> do all of this and more, with no instructions to paste.</p>
          <p><span className="text-ink">Token:</span> on your page, Edit page → Agent access → Mint token. The agent needs it to write to your page.</p>
          <p><span className="text-ink">Then say things like:</span> “Add Vending-Bench 2 to my agentic index.” · “Export the Arena WebDev leaderboard as a CSV.” · “Rewrite my bio and put the coding index first.” · “Make the accent color terracotta.”</p>
        </div>
        <details className="border-t hairline pt-6"><summary className="disclosure disclosure-inline text-[14px] text-ink-2">Read the skill</summary><pre className="mt-4 text-[12.5px] leading-relaxed whitespace-pre-wrap bg-white border hairline rounded-md p-5 mono">{md}</pre></details>
      </div>
    </main></PageTransition>
  );
}
