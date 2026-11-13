export function clampStep(step: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(step, 0), total - 1);
}
