# Client-minted entity ids on create

Offline create-then-edit chains (add a grocery, then tick it off, both queued) break if the server mints entity ids at insert time — every queued mutation behind the create references an id the server never issued. Create procedures on the offline surfaces (groceries, recurring groceries, stores and their aisles, Pantry Ingredients, calendar items, recipes and cookbooks) therefore accept an optional client-generated UUID and insert with it, so queued chains stay valid by construction; id columns are `uuid` and clients generate optimistic UUIDs anyway. Do not "fix" creates back to server-only id generation — it silently breaks Outbox Replay.

One case stays outside the guarantee. The server merges a grocery create into an existing row of the same name and unit, and that row keeps its own id, so a queued edit or check-off of a just-created offline grocery that the server merges fails at Replay. Replay does not predict the merge, keep a client-to-canonical id map, or rewrite later queued inputs; the limitation is accepted.

## Considered options

- Id-rewriting during Replay (map optimistic→real id, patch later entries): rejected — requires per-procedure response knowledge inside generic replay code, and for groceries a client-side copy of the server's merge rule.
- Blocking edits on unsynced entities: rejected — add-then-tick-off is the most common offline action.

## Consequences

- Optimistic-id reconciliation (swapping temp ids for server ids) is unnecessary for these entities.
- Creates outside these surfaces, and merged grocery creates, can still produce broken chains; those entries fail at Replay and are surfaced, not silently dropped, and an edit queued behind a parked create parks with it.
