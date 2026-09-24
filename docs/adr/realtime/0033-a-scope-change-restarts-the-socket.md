# A scope change restarts the socket

A subscription's routing identity — which household channel it listens on, which user channel — is fixed when the subscription starts. When that identity changes, because the user created, joined or left a household, was kicked, or had their account deleted, the server publishes an internal `connection.invalidate` event and every process closes that user's WebSockets with close code 4000. The client reconnects with backoff, every subscription restarts against the current identity, and Recovery (ADR-0011) refetches. This mechanism existed in the old layer without being written down anywhere; the rebuild (ADR-0032) keeps it and records it.

We kept it rather than re-keying live subscriptions in place. Re-keying would require every subscription to watch for membership changes, would race with the very events that announce the change, and would make a Resume cursor (ADR-0034) mutable mid-stream. Restarting the socket costs one reconnect and one refetch for an event that happens a handful of times in an account's life. Two details make it correct: the event that announces the change is always published, and awaited, _before_ the invalidation is published, so the departing view sees the announcement before its socket closes — the old code emitted it unawaited and lost the race; and a user who left a household never resumes that household's channel, because Resume channels are derived from the current identity and a cursor minted under the old one is refused as `identity-changed`.

## Consequences

- Household membership changes are visible to operators as socket restarts, not as silent resubscriptions. An admin transfer is not one: the household key stays the same, so nothing a subscription listens on changes.
- The client treats 4000 like any other non-terminal close and reconnects with backoff; only 4401 (sign in again) stops it.
- Any new fact that changes what a user may receive — a future sharing or team model — is announced through `connection.invalidate`, not by teaching subscriptions to follow it.
- The `connection` domain is `internal`: it is published through the same domain object as every other event and consumed by the hub, but it is never subscribable from a client and never buffered.
