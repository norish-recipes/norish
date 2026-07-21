# Newly created recipes join the Warm Set on create

The Warm Set guarantees the 50 most-recent recipes in full, topped up by the Cache Warmer at each open/reconnect (ADR-0001). That leaves a gap for a recipe the user *just* created: it sits in the query cache only at the default 10-minute `gcTime` until the next warm re-selects it, so "add a recipe, then go Offline" can lose it — garbage-collected before the trip, or never persisted as a durable Warm Set member across a reload. We close the gap by promoting a freshly-created recipe into the Warm Set at create time — stamping the long warm `gcTime` on its `recipes.get` entry — so it is durably offline-available immediately, without waiting for the next warm. This applies to **recipes only**: groceries, stores and planned items are warmed as whole-list caches, so a newly created one is already inside the warmed list and needs no promotion. It must also cover the *offline* create — the optimistic, Outbox-queued entry (client-minted id, ADR-0003) is stamped too, so a recipe created while already Offline survives a reload. We rejected relying on the next warm (the gap above), and rejected keeping all off-screen warmed content continuously fresh via app-wide subscriptions — far more machinery than the one flow ("I just added this") justifies.

## Consequences

- The recipe create hook gains deliberate awareness of the Warm Set (a warm `gcTime` stamp) — recorded here so it is not later "cleaned up" as a stray option.
- The Warm Set can briefly exceed its 50-recipe floor after several creates; the next warm re-selects the canonical 50, so the overage self-heals.
- Shipped as its own commit, separate from the status-modal commit that prompted it.
