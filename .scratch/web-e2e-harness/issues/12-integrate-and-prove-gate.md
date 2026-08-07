# 12 — Integrate and prove the consolidated browser gate

**What to build:** Prove the completed expand–migrate–contract refactor as one production-like acceptance gate. Resolve integration defects, demonstrate focused and combined execution, and record every repository gate honestly.

**Blocked by:** 11 — Contract the legacy harness and CI surface

**Status:** ready-for-agent

- [ ] The `offline` Playwright project passes independently against a current production build.
- [ ] The `ai` Playwright project passes independently against the same current production build.
- [ ] The combined repository E2E command builds once and passes both projects sequentially.
- [ ] Representative AI scenarios pass when selected individually, proving they do not depend on browser state or prior tests.
- [ ] The Offline project retains its intentional serial persistent-browser journey.
- [ ] A controlled failing browser scenario produces a retained trace in the single results directory, and the temporary failure is removed afterward.
- [ ] Running the complete browser gate creates or modifies no tracked documentation screenshots.
- [ ] Searches find no old runner commands, old configuration names, old result paths, duplicated global setup, or catch-all harness references.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test:run` passes.
- [ ] `pnpm i18n:check` passes.
- [ ] `pnpm build` passes.
- [ ] Passed, failed, and environmentally blocked checks are reported separately; an unavailable Docker or browser environment is not reported as acceptance.
