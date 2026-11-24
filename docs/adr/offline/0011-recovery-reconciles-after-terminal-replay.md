# Recovery reconciles after terminal Replay

## Decision

Recovery permits ordinary reads and realtime cache updates to race with Replay because brief visual inconsistency is acceptable. Realtime events are a low-latency fast path, and Resume fills a short gap from a bounded buffer (ADR-0034), but Redis Pub/Sub is not durable and the buffer is bounded, so neither is the cache-consistency guarantee.

After an owner's Replay batch drains or parks its terminal failures, Recovery performs one authoritative refetch of active queries and then tops up the Warm Set. It does not refetch after every Outbox entry or maintain a mutation-to-query registry. A retryable batch remains in Recovery until it reaches a terminal state.

Initial Live startup, return from Offline, WebSocket reconnection, a Live verdict while the owner's Outbox holds pending work, manual sync, and manual retry all trigger the same single-flight Recovery operation. Callers observe only `isSyncing`; Replay does not publish a second progress state. A return from Offline, a reconnection and a manual run always refetch, because the reads may have fallen behind. Startup and a pending-work verdict refetch only when Replay actually sent something, because the reads were just fetched and only the queued writes are behind.

A mutation can fail on reachability without the backend ever counting as Offline: the request dies on a radio handover while the health probe keeps succeeding and the socket never drops. So an admission while Live is a reachability hint, like a WebSocket drop: it asks the connectivity loop to probe at once, and every Live verdict — the heartbeat included, not only the Offline→Live transition — runs Recovery when the owner's Outbox holds pending work. Without that, such a mutation would wait for an unrelated reconnect while routine refetches replaced its optimistic state with older server data, and the brief inconsistency accepted above would become indefinite (issue #565).

Recovery does not introduce a separate state machine for refetch failures. Existing cached data remains usable, and normal later refetch, realtime, or Recovery activity provides eventual convergence.

## Consequences

- A pre-Replay fetch may briefly replace optimistic data with older server data.
- The post-Replay refetch guarantees convergence without relying on WebSocket delivery.
- A failed refetch leaves the current cache intact and leaves convergence to later normal activity.
- The path-agnostic Outbox remains separate from query-specific cache policy.
- There is no detached Replay retry timer and no separate Reconnect Sequence: the connectivity loop's own cadence is the retry cadence.
