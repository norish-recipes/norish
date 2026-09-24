# Recovery reconciles after terminal Replay

## Status

Implemented on July 23, 2026.

## Decision

Recovery permits ordinary reads and realtime cache updates to race with Replay because brief visual inconsistency is acceptable. Realtime events remain a low-latency fast path, but Redis Pub/Sub delivery is not durable and therefore is not the cache-consistency guarantee.

After an owner's Replay batch drains or parks its terminal failures, Recovery performs one authoritative refetch of active queries and then tops up the Warm Set. It does not refetch after every Outbox entry or maintain a mutation-to-query registry. A retryable batch remains in Recovery until it reaches a terminal state.

Initial Live startup, return from Offline, WebSocket reconnection, manual sync, and manual retry all trigger the same single-flight Recovery operation. Callers observe only `isSyncing`; Replay does not publish a second progress state.

Recovery does not introduce a separate state machine for refetch failures. Existing cached data remains usable, and normal later refetch, realtime, or Recovery activity provides eventual convergence.

## Consequences

- A pre-Replay fetch may briefly replace optimistic data with older server data.
- The post-Replay refetch guarantees convergence without relying on WebSocket delivery.
- A failed refetch leaves the current cache intact and leaves convergence to later normal activity.
- The path-agnostic Outbox remains separate from query-specific cache policy.
- The detached Replay retry timer and the separate Reconnect Sequence are removed.

## Amendment (September 21, 2026)

A mutation can fail on reachability without the backend ever counting as Offline: the request dies on a radio handover while the health probe keeps succeeding and the socket never drops. Such a mutation was admitted to the Outbox and then had no trigger at all — none of the transitions above happened — so it waited for some unrelated reconnect while routine refetches replaced its optimistic state with older server data, and the "brief" inconsistency accepted above became indefinite (issue #565).

An admission while Live is now a reachability hint, like a WebSocket drop: it asks the connectivity loop to probe at once. And every Live verdict — the heartbeat included, not only the Offline→Live transition — runs Recovery when the owner's Outbox holds pending work. Such a run follows the startup rule: it refreshes the reads only when Replay actually sent something, because the reads never fell behind. The single-flight operation, the drain-before-refetch ordering, and the absence of a detached retry timer are unchanged: the connectivity loop's own cadence is the retry cadence.
