import { redirect } from "next/navigation";
import { loadSnapshot } from "@/data/load";
import { Onboarding } from "@/onboarding/Onboarding";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  if (sp.i != null || sp.date != null || sp.design != null || sp.handle != null) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
    }
    redirect(`/builder?${query}`);
  }
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
  return <Onboarding snapshot={snapshot} />;
}
