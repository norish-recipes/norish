# 10 — Migrate Prompt restart and default scenarios

**What to build:** Move Prompt default and upgrade coverage onto the consolidated AI fixture, using one exceptional production-process restart control while preserving the same database, Redis, uploads, authentication records, and external-model adapter.

**Blocked by:** 04 — Establish the isolated AI project

**Status:** ready-for-agent

- [ ] A clean installation still shows shipped Prompt defaults without pinning copies in stored configuration.
- [ ] An upgrade boot still releases retired defaults while preserving a genuine administrator customization.
- [ ] Saving Prompt changes still stores only real overrides.
- [ ] Reverting a Prompt to its shipped default still removes the stored override.
- [ ] The restart control stops and starts only the production process and waits for closed-port and health readiness signals.
- [ ] Restart fails clearly if the process cannot stop or become healthy; it does not silently replace the entire AI stack.
- [ ] Each scenario arranges and restores its own stored Prompt row and external-model plan.
- [ ] Prompt persistence probes and retired-default support remain local to Prompt test support.
- [ ] Every scenario runs independently with a fresh browser page while retaining the intended deployment-restart semantics.
- [ ] The migrated scenarios pass independently and through the consolidated `ai` project.
