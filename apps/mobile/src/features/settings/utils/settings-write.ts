import { isOfflineNow } from "@/lib/offline/offline-now";

/** A Settings write that checks Offline as it runs: a confirm accepted after the connection
 * dropped must not fire, as no Settings write enters the Outbox. Hands back the write's result. */
export const guardWrite =
  <A extends unknown[], R>(isOffline: () => boolean, write: (...args: A) => R) =>
  (...args: A): R | undefined =>
    isOffline() ? undefined : write(...args);

/** How long a Settings write may go unanswered before it is released as failed: well past a slow
 * line's answer, short enough that a locked sheet frees while the reader is still looking at it. */
export const SETTINGS_WRITE_TIMEOUT_MS = 30_000;

const NO_ANSWER = "common.errors.noAnswer";
let tellNoAnswer: (messageId: string) => void = () => {};

/** Who tells the reader a write went unanswered; hands back the undo. */
export const listenForNoAnswer = (tell: (messageId: string) => void) => {
  tellNoAnswer = tell;

  return () => {
    if (tellNoAnswer === tell) tellNoAnswer = () => {};
  };
};

const inFlight = new Map<string, Promise<unknown>>();

/** Holds the write `key` names while it is in flight: a repeat shares its outcome instead of
 * sending again. One unanswered for the timeout is released, told with `noAnswer`, and resolves undefined. */
export const guardRepeat =
  <A extends unknown[], R>(key: string, write: (...args: A) => R, noAnswer = NO_ANSWER) =>
  (...args: A): Promise<Awaited<R> | undefined> => {
    const held = inFlight.get(key);

    if (held) return held as Promise<Awaited<R> | undefined>;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const released = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        tellNoAnswer(noAnswer);
        resolve(undefined);
      }, SETTINGS_WRITE_TIMEOUT_MS);
    });
    const outcome = Promise.race([(async () => write(...args))(), released]).finally(() => {
      clearTimeout(timer);
      if (inFlight.get(key) === outcome) inFlight.delete(key);
    });

    inFlight.set(key, outcome);

    return outcome;
  };

/** Wraps a Settings write so it re-reads Offline when it runs; every Settings write goes through it.
 * With a `key`, it is held as `guardRepeat` says, told with `noAnswer` if it goes unanswered. */
export function settingsWrite<A extends unknown[], R>(
  send: (...args: A) => R
): (...args: A) => R | undefined;
export function settingsWrite<A extends unknown[], R>(
  send: (...args: A) => R,
  key: string,
  noAnswer?: string
): (...args: A) => Promise<Awaited<R> | undefined>;
export function settingsWrite<A extends unknown[], R>(
  send: (...args: A) => R,
  key?: string,
  noAnswer?: string
) {
  return key === undefined
    ? guardWrite(isOfflineNow, send)
    : guardRepeat(key, guardWrite(isOfflineNow, send), noAnswer);
}
