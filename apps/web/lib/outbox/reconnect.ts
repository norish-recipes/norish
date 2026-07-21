/**
 * The Reconnect Sequence (design record: "The Reconnect Sequence").
 *
 * When Live returns, three things must happen in exactly this order:
 *
 *   1. Drain the Outbox — replay queued mutations to completion or halt.
 *   2. Invalidate all queries — refetch server truth.
 *   3. Warm — top the Warm Set back up.
 *
 * The ordering is the whole point: refetching before draining would show server
 * state that doesn't yet include the queued changes, so those changes would
 * visibly vanish and then reappear once replayed. This sequence replaces the
 * bundle's `invalidateOnReconnect`, which is switched off for web.
 */

export interface ReconnectSequenceSteps {
  /** Replay the Outbox to completion or halt (leader-gated). */
  drain: () => Promise<unknown>;
  /** Refetch server truth (invalidate all queries). */
  invalidate: () => Promise<unknown>;
  /** Top the Warm Set back up. */
  warm: () => Promise<unknown>;
}

export async function runReconnectSequence({
  drain,
  invalidate,
  warm,
}: ReconnectSequenceSteps): Promise<void> {
  await drain();
  await invalidate();
  await warm();
}
