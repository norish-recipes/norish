# 06 — Migrate bulk Recipe Enrichment scenarios

**What to build:** Move Bulk Recipe Enrichment onto the consolidated AI fixture with deterministic per-scenario prerequisites, preserving the administrator-visible confirmation and the full real enrollment path.

**Blocked by:** 04 — Establish the isolated AI project

**Status:** ready-for-agent

- [ ] AI-disabled refusal remains covered and proves that no work reaches the external-model adapter.
- [ ] Cancelling the confirmation remains covered and proves that nothing is enrolled.
- [ ] A confirmed run still fills eligible gaps through enabled Recipe Enrichment kinds.
- [ ] Supplied Recipe Data still suppresses or constrains automatic work according to the existing domain rules.
- [ ] Bulk Recipe Provenance still fills gaps around supplied slots and skips a complete group.
- [ ] Each scenario creates or deterministically arranges the recipes it needs instead of relying on another test's browser journey.
- [ ] Each scenario restores global AI and automatic-enrichment configuration it changes.
- [ ] Bulk-specific browser actions and stored-result probes remain beside the bulk scenarios.
- [ ] Every scenario can run independently with a fresh browser page.
- [ ] The migrated scenarios pass independently and through the consolidated `ai` project.
