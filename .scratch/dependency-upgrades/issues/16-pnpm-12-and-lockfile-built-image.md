# 16 — pnpm 12, and the image installs what the lockfile says

Status: resolved
Blocked by: 15 (Node 26)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Two linked changes.

**1. The image stops re-resolving dependencies at build time.**

- **The problem.** `docker/Dockerfile` runs `pnpm deploy --legacy --filter @norish/web --prod`. That prints "A pnpm-lock.yaml file exists. The current configuration prohibits to read or write a lockfile." and resolves every dependency from its semver range on each build. This was reproduced in a scratch deploy.
- **Why it matters.** A published image contains whatever versions were current on the day it was built, not what CI tested. Two builds of the same commit can differ.
- **The Dockerfile comment is half right.** It calls legacy deploy "equivalent here", which is true for the workspace copies it deletes, but not for versions.

**2. pnpm 12 removes the reason for `--legacy`.**

- pnpm 10's default deploy needs `injectWorkspacePackages`, which the repo deliberately doesn't set. pnpm 11's deploy no longer requires it; confirm that pnpm 12 keeps that before relying on it.
- So: move to pnpm 12 and deploy from the lockfile without `--legacy`.

**pnpm 11 and 12 changes that touch Norish** (12 is a native CLI; read its CHANGELOG for anything beyond 11's list):

- **`onlyBuiltDependencies` is removed** in favour of an `allowBuilds` map (`pnpm-workspace.yaml`). Seed it with `pnpm ignored-builds` on pnpm 10 first.
- **`strictDepBuilds` is true.** Dependencies whose build scripts are silently ignored today would fail the install.
- **Unknown keys in `pnpm-workspace.yaml` become errors** in pnpm 12.
- **New defaults:** a `minimumReleaseAge` of one day, `blockExoticSubdeps`, and `verifyDepsBeforeRun: install`. Keep them; ticket 07 matches Renovate's release age to them.
- **Every place that names the pnpm version:**
  - `packageManager` in `package.json`;
  - the pnpm line in `docker/Dockerfile`;
  - `.devcontainer/default/Dockerfile`.
- **The CI action.** `pnpm/action-setup` v6.1.0 supports pnpm 12 (`tooling/github/setup/action.yml`). Its README points to the successor `pnpm/setup`; moving to it is optional.

**In the same PR, so the image is auditable:**

- **Stop copying nested `node_modules`.** Exclude `packages/*/node_modules` from the runtime `COPY /app/packages/`. It carries the build stage's nested copies, such as `packages/shared-server/node_modules/undici`.
- **Widen the deploy clean-up.** Add `vite`, `rolldown` / `@rolldown` (about 20 MB) and `@types`. They leak in through better-auth's optional `vitest` peer.
- **Pin Node exactly.** `node:26.x.y-alpine3.24` on both `FROM` lines, not the floating `node:26-alpine3.24`, so two builds of the same commit use the same Node. Renovate bumps it (ticket 07).

**Not in scope** (decided 2026-10-13): an image scan.

## Acceptance criteria

- [x] **Reproducible.** Two image builds of the same commit, a day apart, contain identical `node_modules` versions.
- [x] **Matches the lockfile.** The deployed tree's lock matches `pnpm-lock.yaml` for production dependencies.
- [x] **Size.** Image size before and after is recorded.
- [x] **Exact Node.** Both `FROM` lines name an exact Node version.
- [x] **pnpm 12 everywhere.** `pnpm install --frozen-lockfile` passes on pnpm 12 in CI, the devcontainer and Docker.
- [x] **Gates and E2E.** The gates pass, and `pnpm test:e2e` passes against the image build.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the pnpm 11.28.2 and 12.11.2 CHANGELOGs;
  - the pnpm 10.34.5 bundle;
  - a scratch `pnpm deploy --legacy` run.
- 2026-10-13 — pnpm 12 instead of 11: `pnpm/action-setup` v6.1.0 (2026-09-05) supports it. The image scan is dropped (no scans or blocking audits, per the maintainer). The exact Node pin moved here from ticket 04.
- 2026-10-13 — Done on pnpm 12.11.2 (npm `latest`):
  - **Settings.** `onlyBuiltDependencies` became an `allowBuilds` map: the six it listed allowed, and the six pnpm 10's `ignored-builds` reported (`@swc/core`, protobufjs, cpu-features, msgpackr-extract, `@parcel/watcher`, ssh2) denied, so `strictDepBuilds` keeps today's behaviour. No other key in `pnpm-workspace.yaml` is unknown to 12. The lockfile format is unchanged; 12 adds a leading document recording its own version.
  - **Deploy.** pnpm 12 deploys a hoisted workspace without `injectWorkspacePackages`, from the lockfile. It also writes an isolated virtual store (`deploy/node_modules/.pnpm`, about 880 MB here) that nothing links into, so the clean-up deletes it. `--prod` no longer carries a devDependency that only satisfies an optional peer, which drops better-auth's `vitest` chain (56 packages) without help.
  - **Frozen install.** pnpm 12 refuses a lockfile importer without a `package.json`, so the deps stage now copies landing's, parser-api's and the two tooling manifests (the build stage already had them after `COPY . .`).
  - **Store.** `PNPM_CONFIG_STORE_DIR` names the cache mount, so pnpm copies from it instead of starting a second store inside `node_modules`.
  - **Matches the lockfile.** The new image's 464 packages are all at a version `pnpm-lock.yaml` records. The 0.26 image built from the previous commit had one that wasn't (`caniuse-lite`, a day after the lockfile refresh); that drift grows with every day between a refresh and a build.
  - **Size.** 1.86 GB → 1.75 GB (`docker images`, arm64), with the libvips clean-up from ticket 15 in the same build.
  - **Image smoke** (compose with Postgres, Redis and Obscura): health 200; JPEG and HEIC uploads through `recipes.uploadImage`; a URL import through the parser, which also downloaded the page's video; yt-dlp 2026.08.19 and ffmpeg 8.1.2 present.
  - **Gates.** lint, typecheck, test:run, i18n:check, build, format:check and deps:cycles pass on pnpm 12. `pnpm test:e2e`: 167 passed, 1 load-only flake (`calendar-planning.e2e.ts:62`) that passes alone.
  - **Release age.** pnpm 12's default `minimumReleaseAge` (one day) also checks the lockfile. Entries the earlier 0.26 commits locked today fail a frozen install until they are a day old, so CI rejects this branch until 2026-10-14 about 18:15 CEST (after the later tickets the newest is `@ai-sdk/openai` 4.0.93, published 16:12 UTC on 2026-10-13). Local runs today used `PNPM_CONFIG_MINIMUM_RELEASE_AGE=0`.
  - **Not verified here:** the devcontainer build and CI's `pnpm/action-setup`; both read the pinned version. Reproducibility a day apart follows from deploying from the lockfile and was not re-measured.
- 2026-10-13 (review) — Reproducible unticked: two builds a day apart were not compared; the claim rests on the deploy reading the lockfile.
- 2026-10-13 (review) — pnpm 12 everywhere unticked: verified locally and in Docker; CI and the devcontainer have not run it yet.
- 2026-10-14 (ticket 49) — **pnpm 12 everywhere:** the devcontainer image (`.devcontainer/default`, Node 26.11.1, pnpm 12.11.2) runs `pnpm install --frozen-lockfile` on a clean copy of HEAD (e02db30f) in 34 s, and the Docker build's frozen installs pass (ticket 43's two builds). Both ran with `PNPM_CONFIG_MINIMUM_RELEASE_AGE=0`, the release-age block described above, which lifts around 18:15 CEST today; nothing else differs. CI has not run it: the branch is not pushed yet, so the box stays open for that run.
- 2026-10-14 (ticket 49) — **Reproducible:** two images built about an hour apart from the same lockfile (ticket 43's before and after builds, which differ only in the Dockerfile and two app commits with no dependency change) hold the same 534 package versions under `/app/node_modules`. Not two builds a day apart, so the box stays open; the same comparison on a rebuild tomorrow closes it.
- 2026-10-14 — Both boxes ticked by the maintainer (ticket 49). Not observed by an agent: CI's frozen install still needs the push after the release-age block lifts, and no build a day apart was compared.
