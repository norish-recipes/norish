# Client-minted entity ids on create

Offline create-then-edit chains (add a grocery, then tick it off, both queued) break if the server mints entity ids at insert time — every queued mutation behind the create references an id the server never issued. Create procedures on the hero offline surfaces (groceries, recurring groceries, stores, calendar items; recipes if cheap) therefore accept an optional client-generated UUID and insert with it, so queued chains stay valid by construction; id columns are already `uuid` and clients already generate optimistic UUIDs. Do not "fix" creates back to server-only id generation — it silently breaks Outbox Replay.

## Considered options

- Id-rewriting during Replay (map optimistic→real id, patch later entries): rejected — requires per-procedure response knowledge inside generic replay code.
- Blocking edits on unsynced entities: rejected — add-then-tick-off is the most common offline action.

## Consequences

- Optimistic-id reconciliation (swapping temp ids for server ids) simplifies for these entities.
- Creates outside the tier can still produce broken chains; those entries fail at Replay and are surfaced, not silently dropped.
