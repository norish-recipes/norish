# 01 — Production-like AI E2E harness

**What to build:** Establish a reusable browser acceptance seam that runs the production Norish web server with its real database, Redis, queue registry, and workers while replacing only the third-party AI-provider boundary with deterministic test responses. This is a prefactor for the provenance tracer bullets: it must be independently verifiable without adding a fake Norish backend or making a real provider request.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] The browser harness can select deterministic AI success, permanent-failure, and retryable-failure responses without contacting an external AI provider.
- [ ] Controlled responses enter through the registered AI-handler boundary used by a real queued worker; tRPC, persistence, status reads, realtime delivery, and browser rendering remain unmocked.
- [ ] The harness boots the production server against its dedicated PostgreSQL and Redis services and cleans up its isolated state reliably.
- [ ] A passing smoke scenario proves that a browser-triggered operation can enqueue real background work and receive the controlled provider response.
- [ ] The harness is reusable by multiple provenance scenarios and does not couple the existing offline suite to provenance-specific state.
- [ ] Focused browser-harness tests pass and the result is reported explicitly.
