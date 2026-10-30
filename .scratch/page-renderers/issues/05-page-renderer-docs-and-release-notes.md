# 05: Page Renderer docs and release notes

**What to build:** An operator reading the docs can choose a Page Renderer setup.
- The apps/docs parser configuration page describes Obscura and the FlareSolverr/Byparr solver, the fixed order, that Site Auth Tokens need Obscura, and the Allow private addresses switch, with a screenshot of the finished Page Renderers card.
- The configuration page lists the new env vars.
- The 0.26.0 release notes carry the feature line.
- The source comments that still call Obscura the only rendered-page engine are rewritten.

See `.scratch/page-renderers/spec.md` and `docs/agents/feature-docs.md`.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] The parser configuration page has a Page Renderer section, kept minimal (what it does and how to set it up), with a screenshot of the card taken per the docs-screenshot conventions
- [ ] The configuration page documents `PAGE_SOLVER_ENABLED`, `PAGE_SOLVER_ENDPOINT`, `ALLOW_PRIVATE_ADDRESSES` and `PAGE_RENDERER_TIMEOUT_MS`, notes that they only seed the setting at first boot, and removes `OBSCURA_NAVIGATION_TIMEOUT_MS`
- [ ] The 0.26.0 release notes have a feature line for the solver as a Page Renderer
- [ ] No source comment or doc still calls Obscura the only rendered-page engine
- [ ] The apps/docs build passes
