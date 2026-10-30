# Dependency upgrades: everything to its latest stable release in 0.26

Status: done

Researched 2026-10-12 on `rc/0.25.0-beta`, re-checked against the code and the registries on 2026-10-13 on `rc/0.26.0-beta`, and decided with the maintainer the same day. Sources are the npm registry, PyPI, nodejs.org, Docker Hub, `pnpm audit`, `pnpm outdated -r`, real `tsc` runs and the package tarballs themselves. Where a finding rests on reading code rather than on a reproduced run, the ticket says so.

This plan supersedes `.scratch/dependency-security/` tickets 05–09. That plan's 01–04 shipped in 0.25.0 (PR #617); the decisions it made that still hold are carried over below.

## Problem Statement

Norish's dependencies have fallen far enough behind that it is a security problem, not a hygiene one, and nothing stops it recurring.

- 0.25.0 shipped only the urgent patches: Next.js 16.3.8, sharp 0.35.5, Better Auth 1.6.33 and the image on `node:22-alpine3.24`.
- **About 50 direct dependencies have a newer major or minor**, including Node, TypeScript, ESLint, Vitest, BullMQ, ioredis, undici, Better Auth, Next.js, React, motion and pnpm.
- **The gates don't type-check.** apps/web sets `noCheck`, six `typecheck` scripts pass `--noCheck`, and CI has no typecheck step. A real check finds about 44 errors in the packages and 321 in apps/web, among them a real bug (the CalDAV Edit button does nothing). The breaking changes in BullMQ 6, Better Auth 1.7 and HeroUI only show up as type errors, and some hide behind mocks.
- **The image is not installed from the lockfile.** `pnpm deploy --legacy` re-resolves every dependency from its range on each build, so a published image contains whatever was current on its build day, not what CI tested.
- **The Perplexity provider is broken.** Perplexity retired the Sonar API that `@ai-sdk/perplexity` 4 calls on 2026-09-27.
- **`/_next/image` is still served**, unauthenticated, although Norish never uses it.
- **No Renovate or Dependabot configuration exists**, so the lockfile goes stale between sweeps.

## Solution

Every dependency moves to its newest **stable** release. A line stays behind only when it has no stable release or when another package's peer range rejects it (see **Held lines**). The work lands on one branch, `chore/dependency-upgrades` off `rc/0.26.0-beta`, as **one PR into the rc with one commit per line**, in the order under **Sequence**.

## Decisions (2026-10-13)

1. **One plan.** This one. `.scratch/dependency-security/` 05–09 are superseded.
2. **"Latest" means the newest stable release.** No betas, release candidates or canaries. The plan's earlier cautious holds are taken: ioredis 6, undici 8, pnpm 12, Python 3.15.
3. **TypeScript 6 only.** TypeScript 7 waits for typescript-eslint; no side-by-side alias install, because the CI check and Next's build would then use two compilers that can disagree.
4. **Node 26** (LTS from 2026-10-28), with undici 8 and `@types/node ^26`. The AI transport takes its fetch and its `Agent` from the same undici (ticket 42), so the next undici or Node major moves on its own.
5. **Type checking returns first** (ticket 25): the packages, then apps/web, then a `pnpm typecheck` step in CI, before any major bump.
6. **apps/mobile leaves the pnpm workspace** (ticket 23), and the server drops `expo()` and `@better-auth/expo` while the app is parked.
7. **No Renovate in this plan** (ticket 07, wontfix): the maintainer took it out on 2026-10-15, so dependencies move in sweeps like this one. No blocking audit gate in CI, because an advisory published overnight would turn every PR red. No image scan.
8. **No right-sized images in this effort** (ticket 27 dropped). The unused `/_next/image` endpoint is still switched off (`images: { unoptimized: true }`, ticket 26).
9. **Next's and Turborepo's coding-agent checks are on** (ticket 36). A build that stops because the installed Next has an advisory is the signal to upgrade Next. Reversed on 2026-10-14; the sweep had switched them off.
10. **ESLint 10 replaces the plugins that stop at ESLint 9** (ticket 12): `@eslint-react/eslint-plugin` plus `@stylistic/eslint-plugin` for eslint-plugin-react, `eslint-plugin-jsx-a11y-x` for jsx-a11y. eslint-plugin-import is deleted; it enforces nothing.
11. **Sign-in never links accounts** (ticket 10): `accountLinking.disableImplicitLinking: true`. `trustedProviders` stays, because it now only governs linking from a signed-in session. A deleted user's sessions are revoked immediately.
12. **Linking an SSO provider from Settings** is a follow-up after 0.26, as its own feature spec (the maintainer, 2026-10-15). It is not part of this branch or of 0.26.
13. **The image installs from the lockfile** on pnpm 12, and Node is pinned to an exact tag, bumped by hand with the next sweep (ticket 16).
14. **BullMQ 6 and Job Schedulers land in the same release** (tickets 17 and 18). On 6.3.14 the existing boot sweep still finds and removes the repeatables 5.x created, so no stepping-stone release is needed. The sweep must stay.
15. **The lazy-worker suspicion** (ticket 24) is reproduced against real Redis in the BullMQ 6 commit and fixed only if confirmed.
16. **No manual steps for self-hosters** (carried over from the security plan): migrations run at boot. Stored Perplexity model ids are not mapped: reversed on 2026-10-14, when the maintainer deleted the Sonar mapping (ticket 37); an Upgrade note says to pick a preset. The old OIDC callback URL does not keep working: reversed during ticket 09, where the maintainer ruled out legacy code; an Upgrade note covers it.
17. **Transitive advisories are cleared last** (ticket 03): after the sweep, `pnpm audit --audit-level=high` must be clean, with an override only for a transitive package that is still vulnerable. The zod single-copy override stays, moved to the new version.
18. **No 0.24 backport.**

## Sequence

Each step is one commit on `chore/dependency-upgrades`; every commit leaves the gates green.

1. This plan.
2. **25** Type checking returns (packages, apps/web, CI step).
3. **23** apps/mobile out of the workspace; `expo()` dropped.
4. **28** Lockfile refresh within ranges; unused optional peers removed.
5. **11** TypeScript 6 and the toolchain minors.
6. **12** ESLint 10 with the replacement plugins.
7. **13** Vitest 5. **14** tsdown 0.23.
8. **15** Node 26 and undici 8.
9. **16** pnpm 12; the image installs from the lockfile; Node pinned exactly.
10. **26** Next.js 16.4 and React 19.3; optimizer off. The agent checks are back on (36).
11. **19** HeroUI 3.2.6, React Aria and motion 14.
12. **08** zod, tRPC and TanStack Query, then **09** Better Auth 1.7.7 with **10** linking.
13. **17** Job Schedulers, then **18** BullMQ 6 and ioredis 6 with **24** the lazy-worker check.
14. **05** Perplexity 5 with **29** the AI SDK line.
15. **20** archiver 8 and dotenv 18. **21** parse-ingredient 3.
16. **06** and **30** the parser: Python 3.15, uv 0.13 and every Python dependency.
17. **22** The docs site. **07** Renovate (wontfix).
18. **03** Final audit: high-clean, overrides only for what remains.

## Inventory

Versions as of 2026-10-13. Take the newest patch when the work starts.

| Package                                                                     | Today                              | Target (ticket)                                      |
| --------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Node in the image, `.nvmrc`, CI                                             | 22.23.3 (`node:22-alpine3.24`)     | 26 LTS, exact tag (15, 16)                           |
| `@types/node`                                                               | 25.9.5                             | ^26 (15)                                             |
| `undici`                                                                    | 7.29.0                             | 8.11.x (15)                                          |
| `pnpm`                                                                      | 10.34.5                            | 12.x (16)                                            |
| `typescript`                                                                | 5.9.3                              | 6.0.3 (11); 7 held                                   |
| `typescript-eslint`, `turbo`, `prettier`, `vite`, `@playwright/test`, `tsx` | 8.67, 2.10, 3.9.6, 8.2, 1.62, —    | latest (11)                                          |
| `eslint`, `@eslint/js`                                                      | 9.39.5                             | 10.12.x, 10.0.x (12)                                 |
| `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`     | 7.37.5, 6.10.2, 2.32.0             | replaced, replaced, deleted (12)                     |
| `vitest`                                                                    | 4.1.11                             | 5.0.x (13)                                           |
| `tsdown`                                                                    | 0.22.14                            | 0.23.x (14)                                          |
| `next`, `@next/eslint-plugin-next`, `next-intl`                             | 16.3.8, 16.3.2, 4.13.7             | 16.4.x, 16.4.x, 4.14.x (26)                          |
| `react`, `react-dom`, `@types/react`, `@types/react-dom`                    | 19.2.x                             | 19.3.0 (26)                                          |
| image optimizer `/_next/image`                                              | on, unused                         | off (26)                                             |
| `@heroui/react`, `@heroui/styles`, `react-aria-components`, `motion`        | 3.2.4, 1.20.0, 13.1.1              | 3.2.6, 1.22.x, 14.1.x (19)                           |
| `zod`, `@trpc/*`, `@tanstack/react-query`                                   | 4.4.3, 11.18.0, 5.101.4            | 4.6.x, 11.19.x, 5.104.x (08)                         |
| `better-auth`, `@better-auth/core`, `/api-key`                              | 1.6.33                             | 1.7.x (09)                                           |
| `@better-auth/expo`                                                         | 1.6.33                             | removed (23)                                         |
| `@better-auth/utils`                                                        | 0.4.2                              | 0.4.2; better-auth pins it                           |
| `bullmq`                                                                    | 5.81.3                             | 6.3.x (17, 18)                                       |
| `ioredis`                                                                   | 5.11.1                             | 6.x (18), RESP3 (34)                                 |
| `@ai-sdk/perplexity`                                                        | 4.0.48                             | 5.0.x (05)                                           |
| `ai`, other `@ai-sdk/*`, `ai-sdk-ollama`, `openai`                          | 7.0.107 and the matching providers | latest (29)                                          |
| `archiver` (+ `@types/archiver`), `dotenv`                                  | 7.0.1 (6.0.4), 17.4.2              | 8.0.0 (8.0.0), 18.0.x (45)                           |
| `parse-ingredient`                                                          | 2.2.0                              | 3.0.0 (21)                                           |
| `prisma`, `@prisma/client`, `mysql2` (unused optional peers)                | in the lockfile                    | removed (28)                                         |
| `@esbuild-kit/esm-loader` (a dependency of drizzle-kit)                     | in the lockfile                    | stays until drizzle-kit 1.0 (38)                     |
| everything else in the workspace                                            | —                                  | latest within range (28) or latest (owning ticket)   |
| parser-api: Python, uv                                                      | 3.14, 0.12.5                       | 3.15, 0.13.x (30)                                    |
| parser-api: fastapi, uvicorn, beautifulsoup4, starlette, lxml and the rest  | see 06 and 30                      | latest (06, 30)                                      |
| apps/docs (Docusaurus, React, HeroUI, TypeScript)                           | 3.10.2, 19.2.7, 3.2.4, 5.9.3       | in-range refresh, TypeScript 6 (22)                  |
| apps/mobile                                                                 | Expo SDK 56                        | out of the workspace (23); upgrades with the rewrite |

## Held lines and what unblocks them

| Line                           | Why it waits                                                                                                                                                                                  | Unblocked when                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| TypeScript 7                   | The `typescript` package ships no JS compiler API. typescript-eslint 8.71 requires `<6.1.0`, and Next's build-time check needs the classic API.                                               | typescript-eslint supports TS 7.                |
| zod-openapi 6                  | trpc-to-openapi 3.3.0, the latest, requires `^5.4.4`.                                                                                                                                         | A trpc-to-openapi release accepts 6.            |
| `@better-auth/utils` 0.5       | better-auth 1.7.7, core and api-key pin 0.4.2 exactly.                                                                                                                                        | better-auth moves its pin.                      |
| drizzle-orm 1.0                | Release candidates only (1.0.0-rc.4). 28 `relations()` and 29 `db.query.*` call sites plus drizzle-kit would move.                                                                            | 1.0.0 is stable; then it is its own effort.     |
| Docusaurus 4                   | Canary only.                                                                                                                                                                                  | A stable 4.0.                                   |
| Next.js 17                     | Not released, not even as a canary. 16.4 warns that Cache Components become the default in the next major, and Norish's root layout reads the database, headers and cookies outside Suspense. | 17 ships. Run a Cache Components spike first.   |
| jest-dom's Vitest 5 types      | jest-dom 7.0.1 still augments Vitest 4's `Assertion<T>`; a local shim declares the matchers until then (ticket 32).                                                                           | A release carries testing-library/jest-dom#742. |
| Expo SDK 57, React Native 0.87 | apps/mobile is parked.                                                                                                                                                                        | The mobile rewrite.                             |

## Testing Decisions

- **Every commit passes** the `CONTRIBUTING.md` gates (`pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`), plus `pnpm typecheck` once ticket 25 lands, and `pnpm deps:cycles` and `pnpm format:check`, which CI runs and the local gates don't.
- **E2E** (`pnpm test:e2e`) runs on every commit that touches runtime code. It runs against the prebuilt `dist-server`, so rebuild first.
- **Image changes** are verified by building the image and booting it against Postgres and Redis: the health check, an upload (including HEIC), a URL import through the parser and a video import.
- **Boot migrations** (job schedulers) get a test against real Redis that runs them twice. The maintainer waived starting it from 5.x repeatables on 2026-10-13: it starts from Job Schedulers, and the boot sweep that clears legacy repeatables was checked by reading the BullMQ 5 and 6 tarballs instead (tickets 17 and 18).
- **Auth changes** run the auth E2E specs and an OIDC end-to-end check, including the legacy callback URL.

## Release notes

The Target Version's notes (`apps/docs/docs/release-notes/0.26.0-beta.md`) get:

- **Fixes and Improvements:** the dependency updates in one line; Perplexity on its Agent API; the parser's dependency updates; the unused image optimization endpoint no longer served.
- **Upgrade notes:**
  - Node 26 for installs that run outside Docker (15);
  - the queue upgrade is one-way, so back up Redis before upgrading if you might roll back (18);
  - ID tokens must be RS- or ES-signed, and sign-out no longer ends the IdP session (09); an identity provider that is down when Norish starts no longer needs a restart once it is back (reversed during 09);
  - a stored Sonar model no longer works, so pick a Perplexity preset after updating (05; reversed from "mapped" by 37);
  - the OIDC callback URL moves to `/api/auth/callback/oidc` (09);
  - signing in no longer links accounts (10). Linking a provider from Settings is a later feature, so the notes don't mention it yet.

The toolchain tickets are internal and stay unpublished (ADR-0010).

## Non-goals

- apps/mobile beyond taking it out of the workspace (23). Its upgrade belongs to the rewrite.
- `apps/quick-import-extension`, which is maintained in its own repository.
- Right-sized images (27), dropped on 2026-10-13.
- Linking an SSO provider from Settings: its own feature spec after ticket 09.
- The Next.js 17 / Cache Components and drizzle-orm 1.0 migrations, which wait for stable releases.
- Adopting new framework features beyond what a ticket lists. Candidates for later: React 19.3 `<ViewTransition>`, `next analyze`, the custom server clean-up (`url.parse`, the dead `serveStaticFile`), React Compiler, typedRoutes, Better Auth's `requireIdTokenVerification` and IdP logout, BullMQ 6 typed progress, undici 8 HTTP/2 to AI providers, parse-ingredient's `extractMeasurements()`, Vitest 5's module cache, Node 26's `URLPattern` and `RegExp.escape`.
