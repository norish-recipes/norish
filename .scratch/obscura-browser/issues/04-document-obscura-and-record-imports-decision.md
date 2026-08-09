# 04 — Document Obscura and record the Imports decision

**What to build:** Publish the operator-facing migration guidance and make the rendered-page architecture an explicit, durable Imports decision.

**Blocked by:** 03 — Migrate deployment and contributor environments

**Status:** ready-for-agent

- [ ] Current environment examples and configuration documentation define `OBSCURA_ENDPOINT`, its shipped default, and the expected external-Obscura endpoint contract.
- [ ] Parser and development documentation explain that Obscura renders non-video URL imports before structured parsing and AI fallback consume the HTML.
- [ ] README, website, and Quick Start prose describe the owned Obscura sidecar consistently with the active deployment examples.
- [ ] The Target Version release notes include an operator-facing improvement entry for replacing the third-party Chromium container.
- [ ] The Target Version Upgrade notes call out the breaking `CHROME_WS_ENDPOINT` to `OBSCURA_ENDPOINT` rename and the required service change.
- [ ] A new globally numbered `ADR-0019` is added in an Imports ADR area and the ADR index links it.
- [ ] ADR-0019 records the pinned Norish-owned sidecar, full always-on stealth, official Playwright Core, Obscura-only/no-fallback policy, simplified ownership boundary, and retained private-network protection, including their trade-offs.
- [ ] No unrelated existing ADR is rewritten, frozen versioned documentation remains unchanged, and `CONTEXT.md` gains no Obscura, CDP, or stealth glossary entry.
- [ ] Documentation formatting, generated snippets, links, and the docs build pass their existing validation.
