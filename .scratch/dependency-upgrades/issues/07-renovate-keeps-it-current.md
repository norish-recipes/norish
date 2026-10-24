# 07 — Renovate keeps the dependencies current

Status: wontfix
Blocked by: 16 (pnpm 12 and the exact Node pin Renovate will bump)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Nothing in the repo updates dependencies today, and the stale lockfile this effort found is the result. Add Renovate (`renovate.json`) so it doesn't happen again.

- **Lockfile maintenance.** Weekly `lockFileMaintenance`.
- **Groups:**
  - the pnpm catalog;
  - `@better-auth/*`;
  - `@trpc/*` together with `@tanstack/*`;
  - `ai` together with `@ai-sdk/*`;
  - testcontainers;
  - apps/docs (its own lockfile);
  - uv (apps/parser-api);
  - Docker base images (the exact `node:` tag from ticket 16, uv, the Obscura image);
  - GitHub Actions.
- **Majors** each in their own PR.
- **Release age.** pnpm 12 already enforces a `minimumReleaseAge` of one day; match Renovate's `minimumReleaseAge` to it.
- **Ignored:** `apps/mobile` (parked, outside the workspace) and `apps/quick-import-extension` (another repository).
- **Confirm support** for pnpm catalogs and uv when configuring.

**Not in scope** (decided 2026-10-13): a blocking `pnpm audit` gate in CI, `pip-audit`, and an image scan. An advisory published overnight would turn every PR red. Dependabot alerts stay on as they are.

**Maintainer step.** Install the Renovate GitHub App on the repository.

## Acceptance criteria

- [ ] **Config.** `renovate.json` validates (`npx --package renovate renovate-config-validator`).
- [ ] **Coverage.** Renovate's onboarding or dependency dashboard lists the workspace catalog, apps/docs, apps/parser-api, the Dockerfile and the workflows, and nothing under apps/mobile or apps/quick-import-extension.
- [ ] **App.** The maintainer has installed the app; recorded in the comments.

## Comments

- Filed 2026-10-12 with the spec as "Advisories can't pile up again" (audit gate, pnpm supply-chain settings, Renovate).
- 2026-10-13 — Narrowed to Renovate. The maintainer kept the security plan's call against a CI audit gate. pnpm 12 turns on the supply-chain settings (`minimumReleaseAge`, `blockExoticSubdeps`, `strictDepBuilds`) by default; ticket 16 reconciles them.
- 2026-10-14 — Marked wontfix so agents skip it; the maintainer still does this by hand.
- 2026-10-15 — The maintainer took Renovate out of the plan; spec decision 7 says so.
