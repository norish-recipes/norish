import { setTimeout } from "node:timers/promises";

/**
 * Sends each answer to the page in the order it was asked for, `delayMs` after it was asked and
 * at least `gapMs` after the one before; `pending` holds the ones not sent yet.
 */
export function inOrder(gapMs: number, pending: Set<unknown>) {
  let previous = Promise.resolve(0);

  return async (delayMs: number, answer: Promise<() => unknown>) => {
    const due = Date.now() + delayMs;
    const before = previous;
    let sent!: (at: number) => void;
    const token = {};

    // The slot is taken before the answer comes, so a slow answer holds back the ones after it.
    previous = new Promise((resolve) => (sent = resolve));
    pending.add(token);
    try {
      const send = await answer;
      const after = (await before) + gapMs;

      await setTimeout(Math.max(0, due - Date.now(), after - Date.now()));
      await send();
    } finally {
      pending.delete(token);
      sent(Date.now());
    }
  };
}
