/**
 * Resume algorithm
 *
 * Given the channels a subscription merges and the live iterables already
 * registered on the hub, open (or mint) the Cursor, replay what the Resume
 * Buffer holds after it, and continue live, deduplicating by stream id at the
 * seam. Every way this can fail is a `RealtimeLaggedError`; the subscription
 * factory turns that into `PRECONDITION_FAILED` / `REALTIME_LAGGED`.
 *
 * Stream reads go through the publisher connection: a subscriber connection
 * cannot run `XRANGE`.
 */

import superjson from "superjson";

import type { RealtimeCursor, RealtimeIdentity } from "@norish/shared-server/realtime/resume";
import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { streamKeyFor } from "@norish/shared-server/realtime/channel";
import { RealtimeLaggedError } from "@norish/shared-server/realtime/hub";
import {
  compareStreamIds,
  decodeCursor,
  identityHashFor,
  isStreamIdExpired,
  parseStreamId,
  RESUME_MAXLEN,
  ZERO_STREAM_ID,
} from "@norish/shared-server/realtime/resume";
import { getPublisherClient } from "@norish/shared-server/redis/client";
import { isEventEnvelope } from "@norish/shared/contracts/realtime/envelope";

export interface OpenedCursor {
  cursor: RealtimeCursor;
  /** Whether the cursor came from the client and the buffer must be replayed. */
  resume: boolean;
}

/**
 * Decode the client's cursor, or mint the initial one from each channel's
 * last stream id. Call after the live listeners are registered, so nothing
 * published between the read and the first live event is lost.
 */
export async function openCursor(
  channels: string[],
  identity: RealtimeIdentity,
  lastEventId: string | null | undefined
): Promise<OpenedCursor> {
  const identityHash = identityHashFor(identity);

  if (lastEventId == null) {
    const redis = await getPublisherClient();
    const ids = await Promise.all(
      channels.map(async (channel) => {
        const latest = await redis.xrevrange(streamKeyFor(channel), "+", "-", "COUNT", 1);

        return latest[0]?.[0] ?? ZERO_STREAM_ID;
      })
    );

    return { cursor: { identityHash, ids }, resume: false };
  }

  const cursor = decodeCursor(lastEventId);

  // A user who left a household never reads that household's stream: the
  // channels come from the current context, and a cursor minted for another
  // identity is refused before Redis is touched.
  if (cursor.identityHash !== identityHash || cursor.ids.length !== channels.length) {
    throw new RealtimeLaggedError(channels[0] ?? "", "identity-changed", 0);
  }

  cursor.ids.forEach((id, index) => {
    if (isStreamIdExpired(id)) {
      throw new RealtimeLaggedError(channels[index]!, "cursor-expired", 0);
    }
  });

  return { cursor, resume: true };
}

type Replayed = { index: number; id: string; envelope: RealtimeEventEnvelope };

function parseEntry(index: number, id: string, fields: string[]): Replayed | null {
  const encoded = fields[1];

  if (fields[0] !== "e" || typeof encoded !== "string") return null;

  let parsed: unknown;

  try {
    parsed = superjson.parse(encoded);
  } catch {
    return null;
  }

  if (!isEventEnvelope(parsed)) return null;

  return { index, id, envelope: { ...parsed, meta: { ...parsed.meta, eventId: id } } };
}

/** Read every channel's buffer after the cursor and merge the entries by id. */
async function replayBuffer(channels: string[], cursor: RealtimeCursor): Promise<Replayed[]> {
  const redis = await getPublisherClient();
  const perChannel = await Promise.all(
    channels.map(async (channel, index): Promise<Replayed[]> => {
      const after = cursor.ids[index]!;

      if (after === ZERO_STREAM_ID) return [];

      const key = streamKeyFor(channel);
      const first = await redis.xrange(key, "-", "+", "COUNT", 1);

      // A missing key with a cursor younger than the TTL means nothing was
      // published since: the stream expired after its last write, which the
      // cursor already saw.
      if (first.length === 0) return [];

      // Conservative: the cursor's own entry having been trimmed counts as a gap.
      if (compareStreamIds(first[0]![0], after) > 0) {
        throw new RealtimeLaggedError(channel, "cursor-trimmed", 0);
      }

      const entries = await redis.xrange(key, `(${after}`, "+", "COUNT", RESUME_MAXLEN);

      return entries
        .map(([id, fields]) => parseEntry(index, id, fields))
        .filter((entry): entry is Replayed => entry !== null);
    })
  );

  // K-way merge: within a channel the order is exact; across channels the ids
  // are timestamps, so the order is approximate — which is all it ever was.
  return perChannel.flat().sort((a, b) => compareStreamIds(a.id, b.id));
}

type Pulled =
  | { index: number; result: IteratorResult<RealtimeEventEnvelope> }
  | { index: number; error: unknown };

/**
 * Race N live iterables, tagging each envelope with the index of the channel
 * it came from. Ends when every source has ended; a thrown error ends all.
 * A rejection is captured as a value, so when every channel lags at once
 * (a Redis reconnect ends all of them) the ones the race did not pick are
 * never left as unhandled rejections.
 */
async function* mergeLive(
  live: AsyncIterable<RealtimeEventEnvelope>[],
  signal: AbortSignal | undefined
): AsyncGenerator<{ index: number; envelope: RealtimeEventEnvelope }> {
  const iterators = live.map((iterable) => iterable[Symbol.asyncIterator]());
  const pending = new Map<number, Promise<Pulled>>();

  const pull = (index: number) => {
    pending.set(
      index,
      iterators[index]!.next().then(
        (result): Pulled => ({ index, result }),
        (error): Pulled => ({ index, error })
      )
    );
  };

  iterators.forEach((_, index) => pull(index));

  try {
    while (pending.size > 0 && !signal?.aborted) {
      const pulled = await Promise.race(pending.values());

      pending.delete(pulled.index);

      if ("error" in pulled) throw pulled.error;
      if (pulled.result.done) continue;

      yield { index: pulled.index, envelope: pulled.result.value };
      pull(pulled.index);
    }
  } finally {
    await Promise.all(iterators.map((iterator) => iterator.return?.()));
  }
}

/**
 * Replay the buffer after the cursor, then continue live. The cursor object
 * is advanced in place before each yield, so `encodeCursor(cursor)` at yield
 * time is the id to resume from.
 */
export async function* resumeThenLive(
  channels: string[],
  opened: OpenedCursor,
  live: AsyncIterable<RealtimeEventEnvelope>[],
  signal?: AbortSignal
): AsyncGenerator<RealtimeEventEnvelope> {
  const { cursor } = opened;

  if (opened.resume) {
    for (const { index, id, envelope } of await replayBuffer(channels, cursor)) {
      if (signal?.aborted) return;
      if (compareStreamIds(id, cursor.ids[index]!) <= 0) continue;

      cursor.ids[index] = id;
      yield envelope;
    }
  }

  for await (const { index, envelope } of mergeLive(live, signal)) {
    const id = envelope.meta.eventId;

    // The seam: a live copy of an entry the replay already delivered, or of
    // one the cursor had already seen, is skipped.
    if (parseStreamId(id)) {
      if (compareStreamIds(id, cursor.ids[index]!) <= 0) continue;

      cursor.ids[index] = id;
    }

    yield envelope;
  }
}
