import Link from "next/link";
import { ThemeToggle } from "@/components/Theme";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Privacy" };

const UPDATED = "September 23, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark /><Link href="/builder" className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><ThemeToggle /></span></header>
      <article className="max-w-[720px] mx-auto px-8 py-12 grid gap-7 text-[15px] leading-[1.7] text-ink-2">
        <div>
          <h1 className="text-[36px] text-ink mb-2">Privacy</h1>
          <p className="cap">Last updated {UPDATED}</p>
        </div>
        <p>Priors (mypriors.com) lets you weight AI benchmarks into your own index. You can use it without an account. This page explains what we collect and why.</p>
        <section className="grid gap-2">
          <h2 className="text-[22px] text-ink">Without an account</h2>
          <p>Your indices live in the page address and in your browser&rsquo;s local storage (your lineup, focus, chart preferences, and whether you have seen the intro). When you finish the ranking experiment we record the lineup, focus, fitted benchmark weights and fit score, with no name, email, or account attached, to improve the starting mixes for everyone.</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-[22px] text-ink">With an account</h2>
          <p>Sign-in is handled by Clerk. If you sign in with Google, we receive your name, email address, and profile picture. We use them to create your public page at mypriors.com/&lt;handle&gt; and show your name and picture there. We store your handle, display name, avatar, bio, links, indices, page sections, theme, benchmark imports, and a hashed agent token, which lets your own agent edit your page.</p>
          <p>Your public page and its share cards are visible to anyone. Your email address is never shown publicly.</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-[22px] text-ink">Service providers</h2>
          <p>We use Vercel (hosting), Clerk (authentication), and Convex (database). They process data only to run Priors. We do not sell personal data, show ads, or use third-party advertising trackers.</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-[22px] text-ink">Your choices</h2>
          <p>You can edit or clear your page at any time. To delete your account and profile data, email <a className="text-indigo" href="mailto:adamholter@gmail.com">adamholter@gmail.com</a> from the address you signed in with, and we will remove it. Clearing your browser storage removes the local preferences above.</p>
        </section>
        <section className="grid gap-2">
          <h2 className="text-[22px] text-ink">Contact</h2>
          <p>Questions: <a className="text-indigo" href="mailto:adamholter@gmail.com">adamholter@gmail.com</a>.</p>
        </section>
      </article>
    </main>
  );
}
