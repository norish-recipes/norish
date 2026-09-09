# 04 — The lookup queue: auto-match and refresh

Status: ready-for-human
Blocked by: 02, 03

Spec: `.scratch/simplified-grocery-linking/spec.md`

## What to build

One always-on `storeLookup` queue at concurrency 1 that does two jobs, and the wiring that feeds it.

**Match.** When a Grocery is created, renamed, or moved to another Store, resolve `(store, normalized name)` against the links table. A hit prices the grocery in the same response with no network at all. A miss enqueues a match job: search the Store, drop unpriced candidates, and auto-link only on normalized equality or containment-plus-uniqueness — every word of the grocery's name appearing in exactly one candidate's name. Anything else writes a Miss and stops. A successful match reads the product page for the authoritative Shelf Price and pushes the result to the household.

**Refresh.** A Shelf Price older than 12 hours, on a product attached to a Grocery currently on a list, is refreshed — enqueued when the staleness is noticed while serving the list, capped per page view, never scheduled.

## Notes

**Never enqueue a job on this queue with `delay`.** It is a documented trap in this repo (`packages/queue/src/lazy-worker-manager.ts`): a lazy worker wakes on a `waiting` event and a delayed job is only promoted by a running worker, so delayed jobs sleep forever. This queue is always-on specifically so the work is predictable — do not reintroduce the hazard by scheduling ahead.

Concurrency 1 plus pacing inside the processor **is** the good-citizen fence; do not raise it and do not add a second queue that races it at the same shop. Match jobs take a higher BullMQ priority than refresh jobs so a user's new grocery jumps a stale batch.

There is deliberately no scheduled sweep. A self-hosted instance must never visit a supermarket for a list nobody is shopping.

The always-on worker costs every install another Redis consumer whether or not any Store has a website — accepted, and the reason match latency is predictable.

Push results on the existing Store subscription, merged by product id. Every subscription handler in this app is an idempotent merge by identity, so the actor's own echo is a no-op; keep it that way rather than adding echo suppression.

A shop that answers nothing at all is not a Miss for every candidate — write the Miss for the searched name and stop the job; do not retry inside it.

## Acceptance criteria

- [x] A `storeLookup` queue starts with the workers, always-on, concurrency 1.
- [x] Creating a Grocery whose `(store, name)` link is known returns its Shelf Price with no outbound request.
- [x] Creating a Grocery with an unknown name returns immediately and enqueues a match job.
- [x] Renaming a Grocery, or moving it to another Store, resolves the new key and never carries the old link.
- [x] A normalized-equal candidate auto-links; a name whose words appear in exactly one candidate auto-links.
- [x] A name whose words appear in two or more candidates writes a Miss and links nothing.
- [x] A match reads the product page and stores price, currency, size and `pricedAt`.
- [x] No job on this queue is ever enqueued with `delay`, and a test asserts it.
- [x] Store visits are paced; two match jobs for the same Store do not fetch concurrently.
- [x] A price older than 12 hours refreshes only for products attached to a live Grocery, capped per page view.
- [x] A manual product is never refreshed.
- [x] A landed price reaches other household members over the existing subscription without a reload.

## Comments

- 2026-09-05 (review): a shop that does **not answer** — down, rate-limiting, or turning the visit away with Obscura unreachable — no longer writes a Miss. A Miss is what a shop *said*; a shop that said nothing is asked again on the next view of the list, an hour on at the soonest (the match job id carries the hour). Written as a Miss it priced the name never. Refresh job ids likewise carry the staleness window, because a completed job's id is kept for the administrator's retention and BullMQ refuses a second job with it.
