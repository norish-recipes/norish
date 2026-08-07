# 05 — Migrate core Recipe Enrichment scenarios

**What to build:** Move the core production-like Recipe Enrichment journeys onto the consolidated AI fixture while making every scenario independently runnable and keeping Recipe Enrichment actions and probes local to that test area.

**Blocked by:** 04 — Establish the isolated AI project

**Status:** ready-for-agent

- [ ] Automatic Recipe Enrichment after import remains covered through the real creation, queue, worker, persistence, realtime, and UI path.
- [ ] Automatic Recipe Enrichment after manual recipe creation remains covered.
- [ ] Disabled automatic kinds remain covered without inheriting configuration from another test.
- [ ] Automatic category filling, Supplied Recipe Data precedence, manual replacement, and Tag append behavior remain covered.
- [ ] Quiet automatic failure and visible manual failure remain covered.
- [ ] Lifecycle state across reload and reconnect remains covered.
- [ ] Every scenario arranges and restores its own enrichment configuration, provider plan, and stored prerequisites.
- [ ] Every scenario can run by itself with a fresh browser page.
- [ ] Recipe Enrichment browser actions and database probes live with Recipe Enrichment test support rather than the infrastructure harness.
- [ ] The migrated scenarios pass independently and through the consolidated `ai` project.
