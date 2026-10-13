/**
 * How a published page with several indices is laid out. Each index is a tab, and a section belongs
 * to the tab of the index it draws. Text, links and benchmark tables sit on every tab unless they
 * name an index.
 */
import type { Section } from "../../convex/validators";

type Named = { id: string; name: string };
const DRAWS_INDEX = new Set<Section["kind"]>(["rankings", "pareto", "speed", "gallery", "history"]);

/** The tab a section belongs to; undefined means every tab. A chart that names no live index goes to the first. */
export function sectionTab(s: Section, indices: Named[]): string | undefined {
  return indices.find((i) => i.id === s.indexId)?.id ?? (DRAWS_INDEX.has(s.kind) ? indices[0]?.id : undefined);
}

/**
 * The saved sections plus the ones a page shows without being told: a tab with no charts of its own
 * copies the layout of the first tab that has some (or gets a leaderboard and a cost chart when none
 * does), and every tab gets a More metrics section.
 * Editing saves this list, so the automatic sections become real, movable ones.
 */
export function pageLayout(indices: Named[], sections: Section[]): Section[] {
  const out = [...sections];
  const charts = (id: string) => out.filter((s) => DRAWS_INDEX.has(s.kind) && sectionTab(s, indices) === id);
  const model = indices.map((i) => charts(i.id)).find((list) => list.length) ?? [];
  indices.forEach((i, n) => {
    if (!charts(i.id).length) out.push(...(model.length ? model.map((s) => ({ ...s, id: `${s.id}~${i.id}`, indexId: i.id, title: undefined })) : [{ id: `rank-${i.id}`, kind: "rankings" as const, indexId: i.id }, { id: `pareto-${i.id}`, kind: "pareto" as const, indexId: i.id }]));
    if (!charts(i.id).some((s) => s.kind === "gallery")) out.push({ id: n ? `gallery-auto-${i.id}` : "gallery-auto", kind: "gallery", indexId: i.id });
  });
  return out;
}

/** The sections one tab shows, in page order. */
export function tabSections(layout: Section[], indices: Named[], activeId: string | undefined): Section[] {
  return layout.filter((s) => { const tab = sectionTab(s, indices); return tab === undefined || tab === activeId; });
}

/**
 * "Save to my page" from the builder. An index updates the page index of the same name and keeps its
 * id, so the page's sections and links still point at it. Any other index joins the page as a new
 * tab. Nothing already on the page is dropped: an index is removed on the page itself.
 */
export function saveToPage<T extends Named>(page: T[], built: T[], newId: () => string = () => `i-${crypto.randomUUID().slice(0, 8)}`): { indices: T[]; added: string[] } {
  const indices = [...page], used = new Set<number>(), added: string[] = [];
  const key = (name: string) => name.trim().toLowerCase();
  for (const b of built) {
    const at = indices.findIndex((p, n) => !used.has(n) && key(p.name) === key(b.name));
    if (at >= 0) { used.add(at); indices[at] = { ...b, id: indices[at].id }; continue; }
    let id = newId();
    while (indices.some((p) => p.id === id)) id = newId();
    used.add(indices.length); indices.push({ ...b, id }); added.push(b.name);
  }
  return { indices, added };
}

/** Takes an index off the page along with the sections that drew it. */
export function removeIndex<T extends Named>(indices: T[], sections: Section[], id: string): { indices: T[]; sections: Section[] } {
  return { indices: indices.filter((i) => i.id !== id), sections: sections.filter((s) => s.indexId !== id) };
}
