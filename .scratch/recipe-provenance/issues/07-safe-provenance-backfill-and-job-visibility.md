# 07 — Safe provenance backfill and job visibility

**What to build:** Let administrators safely enrich existing collections by queueing only recipes with no provenance, with idempotent controls and authoritative progress in the existing job-monitoring experience. Partial or existing provenance is preserved unless an editor explicitly re-runs inference from the recipe.

**Blocked by:** 03 — Authorized manual inference and resilient retry; 04 — Administrator provenance configuration

**Status:** ready-for-agent

- [ ] Repository candidate selection includes only recipes whose country, region, cuisine labels, and explanation are all absent.
- [ ] Partial or complete existing provenance is never selected or overwritten by automatic backfill.
- [ ] An admin-only backfill request delegates candidate selection to the repository and job creation to the existing producer, returning aggregate queued, duplicate, and skipped counts promptly.
- [ ] Repeated or overlapping backfill requests are idempotent and do not create duplicate jobs or duplicate AI charges.
- [ ] The admin control distinguishes short request submission from ongoing batch work and cannot remain pending because a realtime event was missed.
- [ ] Administrators can observe queued, active, delayed, completed, failed, attempt, step, duration, and retention information through the existing job monitor and authoritative queue state.
- [ ] Backfill jobs use configured retention, bounded retries, concurrency, stalled-job handling, hanging-job detection, and normal lifecycle shutdown.
- [ ] Disabled settings, missing recipes, permanent failures, retry exhaustion, and successful completion all contribute accurate progress without false success events.
- [ ] Backfill controls and progress are localized, accessible, and restricted to administrators.
- [ ] Repository selection, idempotency, queue monitoring, admin authorization, component, locale, and integration tests for this slice pass.
