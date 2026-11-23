/** The countdown's clock, read to the second. */
export const nowToTheSecond = () => Math.floor(Date.now() / 1000) * 1000;

export const noTick = () => () => undefined;

/** A subscription that ticks each second and stops itself at `expiresAt`, after one last tick;
 * subscribed at or past `expiresAt` it starts no timer. */
export const everySecondUntil = (expiresAt: number) => (onTick: () => void) => {
  if (Date.now() >= expiresAt) return () => undefined;

  const interval = setInterval(() => {
    onTick();
    if (Date.now() >= expiresAt) clearInterval(interval);
  }, 1000);

  return () => clearInterval(interval);
};
