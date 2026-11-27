import { SiteFooter } from "@/components/SiteFooter";
import { PageTransition } from "@/components/PageTransition";
import { pageMeta } from "@/lib/site-meta";
import { RequestForm } from "./RequestForm";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = pageMeta({ title: "Report a bug or make a request", description: "Report a bug, ask for a benchmark Priors does not have yet, or for something Priors should do. You can attach screenshots and logs.", path: "/request" });

export default function RequestPage() {
  return (
    <PageTransition><main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-[660px] mx-auto px-4 sm:px-8 py-12 grid gap-8">
        <div>
          <h1 className="text-[36px] leading-[1.15] mb-3">Report a bug or make a request</h1>
          <p className="text-[16px] text-ink-2 leading-relaxed max-w-[58ch]">Something broken, a benchmark that is missing, something Priors should do, or anything else: say so here, with screenshots or logs if they help. It goes to Adam, who builds Priors.</p>
        </div>
        <RequestForm />
      </div>
      <SiteFooter />
    </main></PageTransition>
  );
}
