export function snapshotVersionChanged(current: string, latest: unknown): boolean {
  return typeof latest === "string" && latest.length > 0 && latest !== current;
}
