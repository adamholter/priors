import { loadSnapshot } from "@/data/load";
import { Onboarding } from "@/onboarding/Onboarding";
export const dynamic = "force-dynamic";
export default async function Home() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
  return <Onboarding snapshot={snapshot} />;
}
