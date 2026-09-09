# 01 — The Pending Link

Status: ready-for-human

Spec: `.scratch/grocery-line-cost/spec.md`

## What to build

A third Product Link state and the loader that shows it.

**The row.** A `store_product_links` row with no product and no `triedAt` is a Pending Link; make `triedAt` nullable and let `ResolvedProductLink.triedAt` be `Date | null`. The producer writes the row when it enqueues a match job. The match job replaces it with a link or a Miss as today, and deletes it when the shop did not answer or when the job gives up after its attempts, so the name is unknown again and the next view asks, an hour on at the soonest. A Pending Link older than the match retry window counts as unknown to the producer's "known" set, so a row left behind by a dead worker never blocks the next question.

**The wire.** The Pending Link rides `linkUpdated` like a Miss does, merged by store and normalized name. `groceryPrices` and `linkFor` return it as a link with `product: null, triedAt: null`.

**The loader.** `grocery-price.tsx` renders a plain loader where the price would be, with an accessible label and no visible words, when the link is pending; a client-side valve treats a Pending Link older than five minutes as unanswered. The grouped row shows it through its price line like any other state.

**The panel.** `use-product-choice.ts` folds a Pending Link into `linkPending`, so the product field shows the loader and waits for the answer instead of searching the shop for a name the queue is already asking about; when the answer lands the field takes it. Typing a different term searches at once, as now.

## Notes

The producer must not leave a Pending Link for a job BullMQ refused as a duplicate id: write the row and add the job in that order, and let the retry-window rule above cover the case where the job existed already, rather than trying to detect it.

Every subscription handler in this app is an idempotent merge by identity; keep the pending row on that path and add no event.

The loader is a loader, not a sentence: no "asking the shop" copy. One i18n key for the accessible label.

## Acceptance criteria

- [x] Creating a grocery with an unknown name in a searchable Store writes a Pending Link and enqueues the match job.
- [x] The row shows a loader while the link is pending and the price, or the invitation, once it is answered, without a reload.
- [x] A housemate's screen shows the same loader over the existing subscription.
- [x] A shop that does not answer leaves no row behind, and the name is asked again on a later view.
- [x] A job that gives up leaves no row behind.
- [x] A Pending Link older than the retry window does not stop the producer from asking again.
- [x] A Pending Link older than five minutes renders as unanswered on the client.
- [x] The grocery panel's product field waits on a Pending Link and does not search the shop for it; typing a term still searches.
- [x] A test asserts no job on this queue is enqueued with `delay`, as before.
- [x] `pnpm lint`, `pnpm test:run` and `pnpm i18n:check` pass.
