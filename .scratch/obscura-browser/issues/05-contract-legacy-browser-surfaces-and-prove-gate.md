# 05 — Contract legacy browser surfaces and prove the migration

**What to build:** Complete the Obscura cutover by removing the obsolete browser contract and proving the integrated repository through its normal acceptance gates.

**Blocked by:** 03 — Migrate deployment and contributor environments; 04 — Document Obscura and record the Imports decision

**Status:** ready-for-agent

- [ ] Active source, configuration, deployment, CI, tests, logs, docs, and package metadata contain no remaining `chrome-headless`, `CHROME_WS_ENDPOINT`, `rebrowser-playwright`, Chrome-service error, or fabricated browser-fingerprint reference.
- [ ] Package manifests and the lockfile contain no Rebrowser dependency or obsolete Playwright generation introduced by the rendered-page runtime.
- [ ] Comments and errors describe the Obscura-only rendered-fetch behavior and do not claim that an undocumented plain HTTP or Chrome fallback exists.
- [ ] Chromium references that genuinely describe the unchanged Playwright browser-acceptance runner remain intact.
- [ ] Existing rendered-fetch, URL-import, video-import, configuration, and affected package tests pass with the new contract.
- [ ] All active Compose definitions pass their configuration-rendering checks.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test:run` passes.
- [ ] `pnpm i18n:check` passes.
- [ ] `pnpm build` passes.
- [ ] The existing `pnpm test:e2e` browser gate passes without changing its Playwright projects or architecture.
- [ ] No dedicated Obscura integration test, Playwright-to-Obscura smoke test, live-site corpus, anti-bot detector, or browser protocol-conformance suite is added.
- [ ] Passed, failed, and environmentally blocked checks are reported separately; an unavailable container or browser environment is not reported as acceptance.
