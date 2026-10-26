import { anchorOf } from "./metrics";

/** The `?r=` value for a ranking on a model page: stable across devices, unlike the position in someone's builder. */
export function rankParam(o: { key: string; label: string }): string {
  const [kind] = o.key.split(":");
  return kind === "preset" ? o.key.slice("preset:".length) : `${kind}-${anchorOf(o.label.replace(/ \(your page\)$/, ""))}`;
}

export function findRanking<T extends { key: string; label: string }>(options: T[], param: string | null | undefined): T | undefined {
  return param ? options.find((o) => rankParam(o) === param) : undefined;
}
