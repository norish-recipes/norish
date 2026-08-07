# 04 — Establish the isolated AI project

**What to build:** Add the `ai` project to the consolidated Playwright configuration and prove its fixture through the smallest production-like AI paths. The project should reuse one isolated stack per worker while every test receives fresh authenticated browser state and clean external-model control.

**Blocked by:** 02 — Expand one shared production-stack implementation; 03 — Move Offline onto the unified Playwright fixture

**Status:** ready-for-agent

- [ ] The consolidated Playwright configuration contains named `offline` and `ai` projects and still uses one worker.
- [ ] The AI fixture owns one isolated PostgreSQL, Redis, uploads area, production process, queue runtime, realtime runtime, and deterministic external-model adapter per worker.
- [ ] Every AI test receives Playwright's ordinary fresh browser context and page authenticated as the deterministic server owner.
- [ ] The external-model adapter resets planned responses, captured requests, and held-response state before and after every test.
- [ ] An unplanned extra external-model request fails loudly instead of consuming state from an earlier test.
- [ ] The smoke import and image-import scenarios run through the new fixture and remain independently runnable.
- [ ] The real AI Runtime transport, queues, workers, repositories, authorization, realtime path, and UI remain active; only the true external model call is replaced.
- [ ] The external-model adapter and its focused unit coverage move into the shared infrastructure harness without weakening success, error, invalid-response, holding, release, or request-capture assertions.
- [ ] Migrated scenarios are no longer selected by the legacy AI configuration, while unmigrated scenarios continue to run there.
- [ ] Both named projects and the transitional repository browser gate pass.
