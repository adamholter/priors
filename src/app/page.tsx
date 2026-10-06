import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PRIORS_MIX_COOKIE } from "@/onboarding/defaults";
import Rank from "./rank/page";

export const dynamic = "force-dynamic";

/**
 * Entry point. Links carrying an index go to the builder; visitors who already finished the ranking
 * (the saved-mix cookie is set when a fit completes) go straight to the builder too. Everyone else
 * gets the onboarding, which stays reachable at /rank.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  if (sp.i != null || sp.date != null || sp.design != null || sp.handle != null) redirect(`/builder?${query}`);
  if ((await cookies()).get(PRIORS_MIX_COOKIE)?.value) redirect(query.size ? `/builder?${query}` : "/builder");
  return <Rank />;
}
