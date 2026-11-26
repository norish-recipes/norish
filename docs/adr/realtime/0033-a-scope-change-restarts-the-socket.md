# A scope change restarts the socket

A subscription's routing identity — which household channel it listens on, which user channel — is fixed when the subscription starts. When that identity changes, because the user joined or left a household, was removed, or had their account deleted, the server publishes an internal `connection.invalidate` event and every process closes that user's WebSockets with close code 4000. The client reconnects with backoff, every subscription restarts against the current identity, and Recovery (ADR-0011) refetches. This mechanism existed in the old layer without being written down anywhere; the rebuild (ADR-0032) keeps it and records it.

We kept it rather than re-keying live subscriptions in place. Re-keying would require every subscription to watch for membership changes, would race with the very events that announce the change, and would make a Resume cursor (ADR-0034) mutable mid-stream. Restarting the socket costs one reconnect and one refetch for an event that happens a handful of times in an account's life. After a membership change commits, the server invalidates household caches and older cursors, announces the change to the moving account, invalidates its connection, then announces it to the remaining members. Each step runs even if an earlier step fails. Resume derives channels from the current identity and refuses a cursor minted under the old one as `identity-changed`.

## Consequences

- Household membership changes are visible to operators as socket restarts, not as silent resubscriptions. An admin transfer is not one: the household id stays the same, so nothing a subscription listens on changes.
- The client treats 4000 like any other non-terminal close and reconnects with backoff; only 4401 (sign in again) stops it.
- Any new fact that changes what a user may receive — a future sharing or team model — is announced through `connection.invalidate`, not by teaching subscriptions to follow it.
- The `connection` domain is `internal`: it is published through the same domain object as every other event and consumed by the hub, but it is never subscribable from a client and never buffered.
