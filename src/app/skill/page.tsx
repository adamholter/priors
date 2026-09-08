import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { CopySkill } from "./CopySkill";

export const metadata = { title: "Agent skill" };

export default async function SkillPage() {
  const md = await readFile(path.join(process.cwd(), "public/skill/SKILL.md"), "utf8");
  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark /><Link href="/" className="text-grey text-[13px] hover:text-ink">Builder</Link></header>
      <div className="max-w-[820px] mx-auto px-8 py-12 grid gap-8">
        <div>
          <h1 className="text-[36px] mb-3">One skill for your agent</h1>
          <p className="text-[16px] text-ink-2 leading-relaxed max-w-[62ch]">Install it in Claude Code, Codex, or any agent that reads skill files — or paste it into a chat. It tells the agent how to research a benchmark you want, the exact JSON to produce, how to upload it to your page, and how to restyle or rewrite your page when you ask.</p>
        </div>
        <CopySkill md={md} />
        <div className="grid gap-3 text-[14px] text-ink-2">
          <p><span className="text-ink">Install:</span> save as <code className="mono">.claude/skills/priors/SKILL.md</code> (Claude Code), <code className="mono">.codex/skills/priors/SKILL.md</code> (Codex), or <code className="mono">.agents/skills/priors/SKILL.md</code>. Raw file: <a href="/skill/SKILL.md" className="text-indigo">/skill/SKILL.md</a></p>
          <p><span className="text-ink">Token:</span> on your page, Edit page → Agent access → Mint token. The agent needs it to write to your page.</p>
          <p><span className="text-ink">Then say things like:</span> “Add Vending-Bench 2 to my agentic index.” · “Rewrite my bio and put the coding index first.” · “Make the accent color terracotta.”</p>
        </div>
        <details className="border-t hairline pt-6"><summary className="cursor-pointer text-[14px] text-ink-2">Read the skill</summary><pre className="mt-4 text-[12.5px] leading-relaxed whitespace-pre-wrap bg-white border hairline rounded-md p-5 mono">{md}</pre></details>
      </div>
    </main>
  );
}
