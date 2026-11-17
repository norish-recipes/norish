/** `offset` held to how far a picture `scale` times a screen `side` wide may travel: half of what overhangs. */
export function clampOffset(offset: number, side: number, scale: number) {
  "worklet";
  const limit = Math.max(0, (side * (scale - 1)) / 2);

  return Math.min(limit, Math.max(-limit, offset));
}
