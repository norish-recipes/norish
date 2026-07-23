# First-writer-wins on Replay conflicts

When a queued offline patch replays against an entity that changed meanwhile, the existing optimistic-concurrency guard stands: the server drops the stale patch (`{stale: true}`) and the online writer's state wins — but the dropped Outbox entry is Parked as Conflicted so the user can see and reapply it, never silently discarded. We explicitly considered letting replayed patches force-apply field-wise (offline tick survives a concurrent rename) and deferred it: it needs a replay-marker protocol and conditional version-guard semantics server-side, and household-scale conflict frequency doesn't yet justify it. Revisit if lost-tick conflicts show up in practice.

## Consequences

- The Replay engine must inspect *successful* responses for `stale: true` — a conflict is not a transport error.
- Offline edits always lose to concurrent online edits, even on non-competing fields (a rename beats a tick).
