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

type Tell = (messageId: string, severity?: "danger" | "success") => void;
let tellReader: Tell = () => {};

/** Who tells the reader a write went unanswered, or went through after all; hands back the undo. */
export const listenForWriteNotices = (tell: Tell) => {
  tellReader = tell;

  return () => {
    if (tellReader === tell) tellReader = () => {};
  };
};

/** Tells the reader a write released as unanswered went through after all. */
export const tellWentThroughLate = () => tellReader("common.lateAnswer.title", "success");

/** A call dropped as a repeat of the write in flight under its key: neither success nor failure. */
export const DROPPED = Symbol("dropped");

const inFlight = new Map<string, object>();

/** Holds the write `key` names while in flight: a repeat is dropped, never sent. One unanswered for
 * the timeout is released, told with `noAnswer`, resolves undefined, and hands a later answer to `late`. */
export const guardRepeat =
  <A extends unknown[], R>(
    key: string,
    write: (...args: A) => R,
    noAnswer = NO_ANSWER,
    late?: (answer: Awaited<R>) => void
  ) =>
  (...args: A): Promise<Awaited<R> | undefined | typeof DROPPED> => {
    if (inFlight.has(key)) return Promise.resolve(DROPPED);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let isReleased = false;
    const released = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        isReleased = true;
        tellReader(noAnswer);
        resolve(undefined);
      }, SETTINGS_WRITE_TIMEOUT_MS);
    });
    const request = (async () => write(...args))();

    // A race of one types the answer as awaited.
    void Promise.race([request]).then(
      (answer) => isReleased && late?.(answer),
      () => {}
    );
    const held = {};

    inFlight.set(key, held);

    return Promise.race([request, released]).finally(() => {
      clearTimeout(timer);
      if (inFlight.get(key) === held) inFlight.delete(key);
    });
  };

/** Wraps a Settings write, the request only, so it re-reads Offline when it runs; every Settings
 * write goes through it. With a `key`, it is held as `guardRepeat` says. */
export function settingsWrite<A extends unknown[], R>(
  send: (...args: A) => R
): (...args: A) => R | undefined;
export function settingsWrite<A extends unknown[], R>(
  send: (...args: A) => R,
  key: string,
  noAnswer?: string,
  late?: (answer: Awaited<R> | undefined) => void
): (...args: A) => Promise<Awaited<R> | undefined | typeof DROPPED>;
export function settingsWrite<A extends unknown[], R>(
  send: (...args: A) => R,
  key?: string,
  noAnswer?: string,
  late?: (answer: Awaited<R> | undefined) => void
) {
  return key === undefined
    ? guardWrite(isOfflineNow, send)
    : guardRepeat(key, guardWrite(isOfflineNow, send), noAnswer, late);
}
