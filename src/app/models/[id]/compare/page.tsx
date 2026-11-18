import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ModelCompare } from "@/components/model/ModelCompare";
import { loadSnapshot } from "@/data/load";
import type { Snapshot } from "@/data/types";
import { defaultConfig } from "@/engine";
import { compareView, defaultPreset, presetConfig } from "@/lib/model-view";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function pair(snapshot: Snapshot, id: string, asked: unknown) {
  const mix = presetConfig(snapshot, defaultPreset(snapshot, id)), known = (m: unknown): m is string => typeof m === "string" && m !== id && snapshot.models.some((x) => x.id === m);
  return { mix, other: known(asked) ? asked : undefined };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, { with: asked }, snapshot] = await Promise.all([params, searchParams, loadSnapshot()]);
  const a = snapshot?.models.find((m) => m.id === id);
  if (!snapshot || !a) return { title: "Page not found" };
  const { other } = pair(snapshot, id, asked), b = snapshot.models.find((m) => m.id === other);
  return pageMeta({ title: b ? `${a.name} vs ${b.name}` : `Compare ${a.name}`, description: b ? `${a.name} and ${b.name} on cost, speed, categories and every benchmark both took.` : `Compare ${a.name} with another model.`, path: `/models/${encodeURIComponent(id)}/compare${b ? `?with=${encodeURIComponent(b.id)}` : ""}` });
}

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { with: asked }, snapshot] = await Promise.all([params, searchParams, loadSnapshot()]);
  if (!snapshot?.models.some((m) => m.id === id)) notFound();
  const { mix, other } = pair(snapshot, id, asked);
  return <ModelCompare key={`${id}|${other ?? ""}`} view={compareView(snapshot, id, other, mix, defaultConfig(snapshot))} />;
}
