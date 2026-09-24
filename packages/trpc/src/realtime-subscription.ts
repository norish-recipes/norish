/**
 * Subscription factory
 *
 * `realtimeSubscription(domain, event)` makes every subscription procedure one
 * line. It derives the channels from the event's Scope and the subscriber's
 * current identity, registers the live listeners on the hub before it reads
 * the Resume Buffer, validates every event against the catalogue, and yields
 * `tracked()` envelopes only — plus a Cursor Mark first, so a subscription
 * that never saw an event is resumable too.
 *
 * Every way a subscription can fall out of order ends it with
 * `PRECONDITION_FAILED` / `REALTIME_LAGGED`; the client refetches and
 * resubscribes (ADR-0032, ADR-0034).
 */

import { tracked, TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RealtimeDomain } from "@norish/shared-server/realtime/domain";
import type {
  ClientEventName,
  PayloadOf,
  RealtimeCatalogue,
} from "@norish/shared/contracts/realtime/catalogue";
import type {
  RealtimeCursorMark,
  RealtimeEventEnvelope,
} from "@norish/shared/contracts/realtime/envelope";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { getRealtimeHub, RealtimeLaggedError } from "@norish/shared-server/realtime/hub";
import { encodeCursor } from "@norish/shared-server/realtime/resume";
import { CURSOR_MARK, REALTIME_LAGGED } from "@norish/shared/contracts/realtime/envelope";

import { authedProcedure } from "./middleware";
import { openCursor, resumeThenLive } from "./realtime-resume";

/** tRPC's WebSocket link merges `lastEventId` into the input of a tracked subscription. */
export const realtimeSubscriptionInput = z.object({ lastEventId: z.string().nullish() }).optional();

export type RealtimeSubscriptionInput = z.infer<typeof realtimeSubscriptionInput>;

export type RealtimeSubscriptionItem<P> = RealtimeEventEnvelope<P> | RealtimeCursorMark;

export interface RealtimeSubscriptionOptions {
  maxQueue?: number;
}

export function realtimeSubscription<C extends RealtimeCatalogue, E extends ClientEventName<C>>(
  domain: RealtimeDomain<C>,
  event: E,
  opts?: RealtimeSubscriptionOptions
) {
  const schema = domain.catalogue.events[event]!.payload;

  return authedProcedure.input(realtimeSubscriptionInput).subscription(async function* ({
    ctx,
    input,
    signal,
  }) {
    // householdKey === userId when household-less: the household channel stays quiet.
    const identity = { userId: ctx.user.id, householdKey: ctx.householdKey };
    // The CURRENT identity, always; a Scope Change restarts the socket (ADR-0033).
    const channels = domain.channelsFor(event, identity);
    // 1. Listeners first, so nothing published from here on is missed.
    const live = channels.map((channel) =>
      getRealtimeHub().subscribe(channel, { signal, maxQueue: opts?.maxQueue })
    );

    try {
      // 2. Decode the client's cursor, or mint the initial one.
      const opened = await openCursor(channels, identity, input?.lastEventId);

      // 3. Always: a quiet subscription is resumable too.
      yield tracked(
        encodeCursor(opened.cursor),
        CURSOR_MARK as RealtimeSubscriptionItem<PayloadOf<C, E>>
      );

      // 4. Replay the buffer after the cursor, then live.
      for await (const item of resumeThenLive(channels, opened, live, signal)) {
        const parsed = schema.safeParse(item.payload);

        if (!parsed.success) {
          log.warn(
            { channel: item.meta.channel, issues: parsed.error.issues },
            "Dropped realtime event failing its schema"
          );
          continue;
        }

        yield tracked(encodeCursor(opened.cursor), {
          meta: item.meta,
          payload: parsed.data as PayloadOf<C, E>,
        } as RealtimeSubscriptionItem<PayloadOf<C, E>>);
      }
    } catch (err) {
      if (err instanceof RealtimeLaggedError) {
        log.warn(
          {
            userId: identity.userId,
            event,
            channel: err.channel,
            reason: err.reason,
            dropped: err.dropped,
          },
          "Realtime subscription lagged"
        );
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: REALTIME_LAGGED, cause: err });
      }

      throw err;
    } finally {
      // The hub releases a listener on abort; an early exit without an abort
      // (a thrown error, a returned iterator) must release it too.
      await Promise.all(live.map((iterable) => iterable[Symbol.asyncIterator]().return?.()));
    }
  });
}
