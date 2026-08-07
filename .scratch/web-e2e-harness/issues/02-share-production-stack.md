# 02 — Expand one shared production-stack implementation

**What to build:** Make both existing browser suites use one infrastructure implementation while preserving their current runner interfaces. Container provisioning, authentication bootstrap, production-process control, readiness, and cleanup should change in one place without yet forcing every scenario to move.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Offline and AI use the same implementation for PostgreSQL and Redis Testcontainers lifecycle.
- [ ] Offline and AI use the same implementation for production-server start, health readiness, graceful stop, forced-stop fallback, and closed-port verification.
- [ ] Offline and AI use the same implementation for the two-boot authentication configuration sequence and deterministic user creation.
- [ ] Each suite still receives isolated containers, ports, uploads, environment, users, and runtime state.
- [ ] Offline-specific Warm Set seeding remains outside the shared infrastructure implementation.
- [ ] AI-specific configuration and the deterministic external-model adapter remain outside the shared infrastructure implementation.
- [ ] Partial setup failure tears down every resource that was already started.
- [ ] Cleanup continues after an individual teardown failure and reports all cleanup failures.
- [ ] No new third-party harness dependency or generic profile framework is introduced.
- [ ] The existing Offline and AI commands both pass through their current Playwright configurations after the prefactor.
