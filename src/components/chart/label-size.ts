/** Scale the existing chart labels, preserving their desktop/mobile defaults at 100%. */
export function labelScale(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0.75, Math.min(1.75, value)) : 1;
}

export function linkedLabelScale(params: URLSearchParams): number | undefined {
  const raw = params.get("ls");
  if (!raw?.trim() || !Number.isFinite(Number(raw))) return;
  return labelScale(Number(raw) / 100);
}
