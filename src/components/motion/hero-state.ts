export const inventoryGroups = ["Carton", "Tray_A", "Tray_B", "Pack_A", "Pack_B", "Pack_C", "Unit_1", "Unit_2", "Unit_3"] as const;

export function clampProgress(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function easeRange(progress: number, start: number, end: number) {
  const t = clampProgress((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
}

export function inventoryAssembly(progress: number, index: number) {
  const starts = [0.15, 0.2, 0.25, 0.32, 0.38, 0.44, 0.5, 0.54, 0.58];
  return easeRange(clampProgress(progress), starts[index] ?? 0.15, Math.min(0.85, (starts[index] ?? 0.15) + 0.27));
}

export function heroStage(progress: number) {
  const p = clampProgress(progress);
  return p < 0.15 ? "introduction" : p < 0.45 ? "movement" : p < 0.85 ? "assembly" : "workspace";
}

export type HeroMode = "full" | "compact" | "none";
export function heroMode(width: number, height: number, reduced: boolean, saveData: boolean, finePointer = true): HeroMode {
  if (width < 1024 || height < 720 || reduced || saveData || !finePointer) return "none";
  return height < 820 ? "compact" : "full";
}
export function eligibleForHero(width: number, height: number, reduced: boolean, saveData: boolean) {
  return heroMode(width,height,reduced,saveData) !== "none";
}



