/** The countdown's clock, read to the second. */
export const nowToTheSecond = () => Math.floor(Date.now() / 1000) * 1000;

export const noTick = () => () => undefined;

/** A subscription that ticks each second and stops itself at `expiresAt`, after one last tick;
 * it reads the countdown's own clock, so a code shown live always has its timer. */
export const everySecondUntil = (expiresAt: number) => (onTick: () => void) => {
  if (nowToTheSecond() >= expiresAt) return () => undefined;

  const interval = setInterval(() => {
    onTick();
    if (nowToTheSecond() >= expiresAt) clearInterval(interval);
  }, 1000);

  return () => clearInterval(interval);
};
