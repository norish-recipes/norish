# 05 — Automatic inference across every import path

**What to build:** Make automatic Recipe Provenance a property of successful recipe-import completion rather than of one parser. URL, paste, image, multi-recipe, and replayed offline imports all reach the same queueing behavior without delaying import or changing the existing Outbox and Replay guarantees.

**Blocked by:** 02 — Paste import to rendered provenance; 04 — Administrator provenance configuration

**Status:** ready-for-agent

- [ ] Successful URL, structured paste, AI-assisted paste, and image imports each queue provenance exactly once when automatic inference is enabled.
- [ ] Every eligible recipe produced by a multi-recipe paste import is considered independently and receives at most one deterministic job.
- [ ] An offline-queued server-side-effect import reaches the same provenance completion boundary when Replay succeeds online, without adding browser AI execution or a new Outbox mutation type.
- [ ] Import completion is never delayed by provenance inference, and provenance queue or worker failure never rolls back an otherwise successful import.
- [ ] Disabled AI, disabled provenance, disabled automatic inference, duplicate jobs, and already-enriched recipes do not create provider calls or false lifecycle events.
- [ ] Automatic backfill rules are not applied to new-import queueing, and automatic inference never overwrites a recipe that already has any provenance.
- [ ] Queue integration coverage proves parity across all import paths, multi-recipe behavior, deterministic deduplication, and configuration outcomes.
- [ ] Existing offline service-worker, cache, Outbox, and Replay protocols remain unchanged and their relevant regression suites pass.
