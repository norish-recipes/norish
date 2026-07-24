# 08 — Documentation, contributor credit, and release acceptance

**What to build:** Finish Recipe Provenance as a documented, localized, release-ready feature. Users and self-hosting operators can understand the AI-generated attribution, configure it, backfill existing recipes, and recover from failures; the original contribution is visibly credited and every required acceptance gate passes.

**Blocked by:** 03 — Authorized manual inference and resilient retry; 05 — Automatic inference across every import path; 06 — Consistent country flags across web recipe names; 07 — Safe provenance backfill and job visibility

**Status:** ready-for-agent

- [ ] The root glossary defines Recipe Provenance, origin, cuisine label, and provenance inference using the product's agreed language.
- [ ] Product documentation explains AI-generated uncertainty, automatic and manual inference, editable prompt and cuisine vocabulary, backfill, progress, terminal failure, and editor retry behavior.
- [ ] Documentation includes current screenshots of rendered provenance, country-prefixed names, first-load progress, terminal failure and retry, and administrator settings and backfill.
- [ ] The target `0.20.0-beta` release notes describe the feature in product language and credit `@edylan` with a link to pull request #350.
- [ ] Every user-visible string introduced by the feature exists in every bundled locale with no code-level fallback standing in for catalog coverage.
- [ ] Focused repository, queue, worker, API, permission, subscription, component, admin, locale, documentation, and browser suites all pass.
- [ ] The production-like happy-path and terminal-failure/retry browser E2E scenarios pass without contacting a third-party AI provider; an environmentally blocked run is reported as blocked and does not count as completion.
- [ ] The repository definition-of-done gates pass: lint, full test run, locale validation, and production build, plus documentation formatting and production documentation build.
- [ ] Passed, failed, and environmentally blocked validations are reported separately with reproducible manual browser verification steps.
- [ ] No out-of-scope mobile UI, offline architecture, deployment, parser, or unrelated synchronization work is included.
