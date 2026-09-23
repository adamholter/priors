import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { Wordmark } from "@/components/Wordmark";
import { PageTransition } from "@/components/PageTransition";

export default function Page() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="p-10 grid gap-4"><Wordmark /><p className="text-ink-2">Sign-in isn’t configured yet. Anonymous indices still work — copy the link from the builder.</p></main>;
  }
  return (
    <PageTransition><main className="min-h-screen grid place-items-center p-8">
      <div className="grid gap-6 justify-items-center">
        <Wordmark size={30} />
        <SignIn forceRedirectUrl="/claim" signUpForceRedirectUrl="/claim" />
        <Link href="/privacy" className="cap hover:text-ink">Privacy</Link>
      </div>
    </main></PageTransition>
  );
}
