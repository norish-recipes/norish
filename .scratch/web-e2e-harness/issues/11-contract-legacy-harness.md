# 11 — Contract the legacy harness and CI surface

**What to build:** Complete the consolidation after every scenario has migrated. Remove the old runner and catch-all support surface so maintainers see one E2E command, one configuration, one results location, and one CI gate.

**Blocked by:** 01 — Remove documentation capture from browser acceptance; 05 — Migrate core Recipe Enrichment scenarios; 06 — Migrate bulk Recipe Enrichment scenarios; 07 — Migrate Recipe Provenance scenarios; 08 — Migrate Ingredient Linking scenarios; 09 — Migrate Prompt editability scenarios; 10 — Migrate Prompt restart and default scenarios

**Status:** ready-for-agent

- [ ] The two historical browser-suite directory roots and their obsolete configurations, global setups, environment modules, and duplicated process modules are removed.
- [ ] The catch-all AI harness module is removed; infrastructure and domain-specific support remain in their agreed locations.
- [ ] The web workspace exposes one E2E package command for the consolidated Playwright configuration.
- [ ] Profile-specific and documentation-capture package commands are removed.
- [ ] Focused execution remains available through the `offline` and `ai` project selectors.
- [ ] The repository-level browser command builds the production web and bundled server once, then runs the consolidated workspace command.
- [ ] CI invokes one browser E2E step after the existing build and embedded-parser preparation.
- [ ] CI uploads one hidden results directory with retained failure traces.
- [ ] Lint ignores, command comments, and contributor guidance describe the consolidated topology and no longer mention old configurations or result paths.
- [ ] No source, configuration, CI, or documentation reference to the legacy harness surface remains.
- [ ] Both Playwright projects pass through the one workspace command.
